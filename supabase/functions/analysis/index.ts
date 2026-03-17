import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, preflight, corsHeaders } from "../_shared/response.ts";
import { validateBody, validateUUID, validateEnum } from "../_shared/validators.ts";
import { verifyAuth, getUserOrgId, requireOrgRole } from "../_shared/auth.ts";
import { AnalysisStatus } from "../_shared/types.ts";

const STATUSES: readonly AnalysisStatus[] = ["parsing","classifying","risk_analyzing","suggesting","reporting","completed","failed"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/functions\/v1\/analysis/, "") || "/";
  const segs = rawPath.split("/").filter(Boolean);

  try {
    const admin = createAdminClient();

    if (req.method === "PATCH" && segs[1] === "progress" && segs.length === 2) {
      const internalKey = req.headers.get("x-internal-key");
      if (internalKey !== Deno.env.get("INTERNAL_API_KEY")) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid internal key");
      }
      const analysisId = validateUUID(segs[0], "analysisId");
      const body = await validateBody<{ status: string; progress_pct: number; error_message?: string; overall_risk_score?: number; risk_level?: string }>(req);
      const status = validateEnum(body.status, "status", STATUSES);
      const upd: Record<string, unknown> = { status, progress_pct: body.progress_pct ?? 0 };
      if (body.error_message) upd.error_message = body.error_message;
      if (status === "completed") {
        upd.completed_at = new Date().toISOString();
        const { data: an } = await admin.from("analyses").select("started_at").eq("id", analysisId).single();
        if (an?.started_at) upd.duration_ms = Date.now() - new Date(an.started_at).getTime();
      }
      const { data, error } = await admin.from("analyses").update(upd).eq("id", analysisId).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      if (status === "completed" && body.overall_risk_score !== undefined) {
        await admin.from("contracts").update({ status: "completed", overall_risk_score: body.overall_risk_score, risk_level: body.risk_level ?? null }).eq("id", data.contract_id);
      } else if (status === "failed") {
        await admin.from("contracts").update({ status: "failed" }).eq("id", data.contract_id);
      } else {
        await admin.from("contracts").update({ status: "analyzing" }).eq("id", data.contract_id);
      }
      return ok(data);
    }

    const { userId, adminClient } = await verifyAuth(req);
    const orgId = await getUserOrgId(adminClient, userId);

    if (req.method === "POST" && segs[1] === "start" && segs.length === 2) {
      const contractId = validateUUID(segs[0], "contractId");
      await requireOrgRole(admin, orgId, userId, "member");
      const { data: an } = await admin.from("analyses").select("status").eq("contract_id", contractId).order("started_at", { ascending: false }).limit(1).single();
      if (an && ["parsing","classifying","risk_analyzing","suggesting","reporting"].includes(an.status)) {
        throw new AppError(ERROR_CODES.ANALYSIS_IN_PROGRESS, "Analysis already in progress");
      }
      const now = new Date().toISOString();
      const { data, error } = await admin.from("analyses").insert({ contract_id: contractId, status: "parsing", progress_pct: 0, started_at: now, model_version: "claude-3-5-sonnet" }).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      await admin.from("contracts").update({ status: "parsing" }).eq("id", contractId);
      return ok(data);
    }

    if (req.method === "GET" && segs.length === 1) {
      const contractId = validateUUID(segs[0], "contractId");
      await requireOrgRole(admin, orgId, userId, "viewer");
      const { data, error } = await admin.from("analyses").select("*").eq("contract_id", contractId).order("started_at", { ascending: false }).limit(1).single();
      if (error || !data) throw new AppError(ERROR_CODES.NOT_FOUND, "Analysis not found");
      return ok(data);
    }

    if (req.method === "GET" && segs[1] === "stream" && segs.length === 2) {
      const contractId = validateUUID(segs[0], "contractId");
      await requireOrgRole(admin, orgId, userId, "viewer");
      const stream = new ReadableStream({
        async start(controller) {
          const encode = (data: string) => new TextEncoder().encode("data: " + data + "\n\n");
          let done = false;
          while (!done) {
            const { data: an } = await admin.from("analyses").select("status,progress_pct,error_message").eq("contract_id", contractId).order("started_at", { ascending: false }).limit(1).single();
            if (!an) { controller.close(); break; }
            controller.enqueue(encode(JSON.stringify({ status: an.status, progress_pct: an.progress_pct })));
            if (an.status === "completed" || an.status === "failed") { done = true; controller.close(); break; }
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...corsHeaders } });
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + rawPath);
  } catch (err) {
    return handleError(err);
  }
});
