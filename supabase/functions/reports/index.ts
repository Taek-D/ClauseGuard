import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, preflight, corsHeaders } from "../_shared/response.ts";
import { validateBody, validateEnum, validateUUID } from "../_shared/validators.ts";
import { verifyAuth, getUserOrgId, requireOrgRole, requirePlan } from "../_shared/auth.ts";
import { logAudit } from "../_shared/audit.ts";
import { ShareScope } from "../_shared/types.ts";

const SCOPES: readonly ShareScope[] = ["full_report", "high_risk_only"];

async function fetchFullReport(admin: ReturnType<typeof createAdminClient>, contractId: string, scope?: ShareScope) {
  const { data: contract } = await admin.from("contracts").select("*").eq("id", contractId).single();
  if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND, "Contract not found");
  const { data: analysis } = await admin.from("analyses").select("*").eq("contract_id", contractId).order("started_at", { ascending: false }).limit(1).single();
  let risksQ = admin.from("risks").select("*, clauses(*), suggestions(*)").eq("contract_id", contractId).order("order_index");
  if (scope === "high_risk_only") risksQ = risksQ.eq("severity", "high");
  const { data: risks } = await risksQ;
  const high = (risks ?? []).filter((r: { severity: string }) => r.severity === "high").length;
  const medium = (risks ?? []).filter((r: { severity: string }) => r.severity === "medium").length;
  const low = (risks ?? []).filter((r: { severity: string }) => r.severity === "low").length;
  return { contract, analysis, risks: risks ?? [], summary: { high_count: high, medium_count: medium, low_count: low, overall_score: contract.overall_risk_score } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/functions\/v1\/reports/, "") || "/";
  const segs = rawPath.split("/").filter(Boolean);

  try {
    const admin = createAdminClient();

    if (req.method === "GET" && segs[0] === "shared" && segs.length === 2) {
      const token = segs[1];
      const { data: link } = await admin.from("share_links").select("*").eq("token", token).single();
      if (!link) throw new AppError(ERROR_CODES.NOT_FOUND, "Share link not found");
      if (new Date(link.expires_at) < new Date()) throw new AppError(ERROR_CODES.SHARE_LINK_EXPIRED, "Share link has expired");
      await admin.from("share_links").update({ accessed_at: new Date().toISOString() }).eq("id", link.id);
      const report = await fetchFullReport(admin, link.contract_id, link.scope as ShareScope);
      return ok(report);
    }

    const { userId, adminClient } = await verifyAuth(req);
    const orgId = await getUserOrgId(adminClient, userId);

    if (req.method === "GET" && segs.length === 1) {
      const contractId = validateUUID(segs[0], "contractId");
      await requireOrgRole(admin, orgId, userId, "viewer");
      const report = await fetchFullReport(admin, contractId);
      return ok(report);
    }

    if (req.method === "POST" && segs[1] === "export" && segs.length === 2) {
      const contractId = validateUUID(segs[0], "contractId");
      await requireOrgRole(admin, orgId, userId, "member");
      await requirePlan(adminClient, orgId, "starter");
      const body = await validateBody<{ format?: string; language?: string; scope?: string }>(req);
      const report = await fetchFullReport(admin, contractId);
      const lang = body.language === "en" ? "en" : "ko";
      const title = lang === "ko" ? "ClauseGuard 리스크 리포트" : "ClauseGuard Risk Report";
      const fileLabel = lang === "ko" ? "파일명" : "File";
      const scoreLabel = lang === "ko" ? "종합 점수" : "Overall Score";
      const highLabel = lang === "ko" ? "고위험" : "High Risk";
      const medLabel = lang === "ko" ? "중위험" : "Medium Risk";
      const lowLabel = lang === "ko" ? "저위험" : "Low Risk";
      let html = "<!DOCTYPE html><html><head><meta charset=UTF-8><title>" + title + "</title>";
      html += "<style>body{font-family:sans-serif;padding:24px;max-width:800px;margin:auto}h1{color:#1a1a2e}";
      html += ".high{color:#dc2626}.medium{color:#d97706}.low{color:#16a34a}";
      html += ".risk-card{border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0}</style></head><body>";
      html += "<h1>" + title + "</h1>";
      html += "<p><strong>" + fileLabel + ":</strong> " + report.contract.file_name + "</p>";
      html += "<p><strong>" + scoreLabel + ":</strong> " + (report.summary.overall_score ?? "N/A") + "/100</p>";
      html += "<p class=high><strong>" + highLabel + ": " + report.summary.high_count + "</strong></p>";
      html += "<p class=medium>" + medLabel + ": " + report.summary.medium_count + "</p>";
      html += "<p class=low>" + lowLabel + ": " + report.summary.low_count + "</p><hr>";
      for (const risk of report.risks) {
        const cls = risk.severity === "high" ? "high" : risk.severity === "medium" ? "medium" : "low";
        html += "<div class=risk-card><h3 class=" + cls + ">" + risk.title + "</h3>";
        html += "<p>" + risk.description + "</p></div>";
      }
      html += "</body></html>";
      const htmlBytes = new TextEncoder().encode(html);
      const exportKey = "exports/" + orgId + "/" + contractId + "_" + Date.now() + ".html";
      await admin.storage.from("reports").upload(exportKey, htmlBytes, { contentType: "text/html" });
      const { data: urlData } = await admin.storage.from("reports").createSignedUrl(exportKey, 3600);
      await logAudit(admin, { orgId, userId, action: "export", resourceType: "contract", resourceId: contractId });
      return ok({ url: urlData?.signedUrl, expires_at: new Date(Date.now() + 3600000).toISOString() });
    }

    if (req.method === "POST" && segs[1] === "share" && segs.length === 2) {
      const contractId = validateUUID(segs[0], "contractId");
      await requireOrgRole(admin, orgId, userId, "member");
      await requirePlan(adminClient, orgId, "professional");
      const body = await validateBody<{ recipient_email?: string; scope: string; expires_in_days?: number }>(req);
      const scope = validateEnum(body.scope, "scope", SCOPES);
      const expiresInDays = Math.min(30, Math.max(1, body.expires_in_days ?? 7));
      const token = crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
      const { data, error } = await admin.from("share_links").insert({
        contract_id: contractId,
        created_by: userId,
        token,
        recipient_email: body.recipient_email ?? null,
        scope,
        expires_at: expiresAt,
      }).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      await logAudit(admin, { orgId, userId, action: "share", resourceType: "contract", resourceId: contractId, metadata: { scope, recipient_email: body.recipient_email } });
      return ok(data);
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + rawPath);
  } catch (err) {
    return handleError(err);
  }
});
