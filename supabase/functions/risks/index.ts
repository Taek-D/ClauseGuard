import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, preflight } from "../_shared/response.ts";
import { validateUUID } from "../_shared/validators.ts";
import { verifyAuth, getUserOrgId, requireOrgRole } from "../_shared/auth.ts";
import { Severity } from "../_shared/types.ts";

const SEVERITIES: readonly Severity[] = ["high", "medium", "low"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/functions\/v1\/risks/, "") || "/";
  const segs = rawPath.split("/").filter(Boolean);

  try {
    const { userId, adminClient } = await verifyAuth(req);
    const admin = createAdminClient();

    if (req.method === "GET" && segs.length === 0) {
      const contractId = url.searchParams.get("contractId");
      if (!contractId) throw new AppError(ERROR_CODES.VALIDATION_ERROR, "contractId query param is required");
      validateUUID(contractId, "contractId");
      const { data: contract } = await admin.from("contracts").select("org_id").eq("id", contractId).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND, "Contract not found");
      await requireOrgRole(admin, contract.org_id, userId, "viewer");
      let q = admin.from("risks").select("*").eq("contract_id", contractId).order("order_index");
      const severity = url.searchParams.get("severity");
      if (severity && SEVERITIES.includes(severity as Severity)) q = q.eq("severity", severity);
      const { data, error } = await q;
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data);
    }

    if (req.method === "GET" && segs.length === 1) {
      const riskId = validateUUID(segs[0], "riskId");
      const { data: risk } = await admin.from("risks").select("*, clauses(*)").eq("id", riskId).single();
      if (!risk) throw new AppError(ERROR_CODES.NOT_FOUND, "Risk not found");
      const { data: contract } = await admin.from("contracts").select("org_id").eq("id", risk.contract_id).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND, "Contract not found");
      await requireOrgRole(admin, contract.org_id, userId, "viewer");
      return ok(risk);
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + rawPath);
  } catch (err) {
    return handleError(err);
  }
});
