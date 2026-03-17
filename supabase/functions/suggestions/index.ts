import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, preflight } from "../_shared/response.ts";
import { validateBody, validateBoolean, validateUUID } from "../_shared/validators.ts";
import { verifyAuth, requireOrgRole } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/functions\/v1\/suggestions/, "") || "/";
  const segs = rawPath.split("/").filter(Boolean);

  try {
    const { userId } = await verifyAuth(req);
    const admin = createAdminClient();

    if (req.method === "GET" && segs.length === 1) {
      const riskId = validateUUID(segs[0], "riskId");
      const { data: risk } = await admin.from("risks").select("contract_id").eq("id", riskId).single();
      if (!risk) throw new AppError(ERROR_CODES.NOT_FOUND, "Risk not found");
      const { data: contract } = await admin.from("contracts").select("org_id").eq("id", risk.contract_id).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND, "Contract not found");
      await requireOrgRole(admin, contract.org_id, userId, "viewer");
      const { data, error } = await admin.from("suggestions").select("*").eq("risk_id", riskId).maybeSingle();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data);
    }

    if (req.method === "PATCH" && segs[1] === "feedback" && segs.length === 2) {
      const suggId = validateUUID(segs[0], "suggestionId");
      const body = await validateBody<{ accepted: boolean }>(req);
      const accepted = validateBoolean(body.accepted, "accepted");
      const { data: sugg } = await admin.from("suggestions").select("risk_id").eq("id", suggId).single();
      if (!sugg) throw new AppError(ERROR_CODES.NOT_FOUND, "Suggestion not found");
      const { data: risk } = await admin.from("risks").select("contract_id").eq("id", sugg.risk_id).single();
      if (!risk) throw new AppError(ERROR_CODES.NOT_FOUND, "Risk not found");
      const { data: contract } = await admin.from("contracts").select("org_id").eq("id", risk.contract_id).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND, "Contract not found");
      await requireOrgRole(admin, contract.org_id, userId, "member");
      const { data, error } = await admin.from("suggestions").update({ accepted }).eq("id", suggId).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data);
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + rawPath);
  } catch (err) {
    return handleError(err);
  }
});
