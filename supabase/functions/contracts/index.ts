import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, created, noContent, preflight } from "../_shared/response.ts";
import { validateEnum, validateUUID } from "../_shared/validators.ts";
import { verifyAuth, getUserOrgId, requireOrgRole } from "../_shared/auth.ts";
import { logAudit } from "../_shared/audit.ts";
import { IndustryType, ContractType, PartyPosition, FileType } from "../_shared/types.ts";

const FILE_TYPES: readonly FileType[] = ["pdf", "docx", "hwp"];
const CONTRACT_TYPES: readonly ContractType[] = ["subscription", "nda", "service", "partnership", "lease", "other"];
const INDUSTRIES: readonly IndustryType[] = ["saas", "manufacturing", "realestate", "service", "other"];
const POSITIONS: readonly PartyPosition[] = ["provider", "consumer"];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/functions\/v1\/contracts/, "") || "/";
  const segs = rawPath.split("/").filter(Boolean);

  try {
    const { userId, adminClient } = await verifyAuth(req);
    const admin = createAdminClient();
    const orgId = await getUserOrgId(adminClient, userId);

    if (req.method === "GET" && segs.length === 0) {
      const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
      const offset = (page - 1) * limit;
      let q = admin.from("contracts").select("*", { count: "exact" }).eq("org_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      const industry = url.searchParams.get("industry");
      const risk_level = url.searchParams.get("risk_level");
      const contract_type = url.searchParams.get("contract_type");
      const search = url.searchParams.get("search");
      if (industry) q = q.eq("industry", industry);
      if (risk_level) q = q.eq("risk_level", risk_level);
      if (contract_type) q = q.eq("contract_type", contract_type);
      if (search) q = q.ilike("file_name", "%" + search + "%");
      const { data, error, count } = await q;
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data, { total: count ?? 0, page, limit });
    }

    if (req.method === "POST" && segs.length === 0) {
      const contentType = req.headers.get("content-type") ?? "";
      if (!contentType.includes("multipart/form-data")) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Content-Type must be multipart/form-data");
      }
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new AppError(ERROR_CODES.VALIDATION_ERROR, "file is required");
      if (file.size > MAX_FILE_SIZE) throw new AppError(ERROR_CODES.FILE_TOO_LARGE, "File must be <= 50MB");
      const ext = file.name.split(".").pop()?.toLowerCase() as FileType;
      if (!FILE_TYPES.includes(ext)) throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, "File must be PDF, DOCX, or HWP");
      const industry = validateEnum(formData.get("industry") as string, "industry", INDUSTRIES);
      const contract_type = validateEnum(formData.get("contract_type") as string, "contract_type", CONTRACT_TYPES);
      const party_position = validateEnum(formData.get("party_position") as string, "party_position", POSITIONS);
      const template_id = formData.get("template_id") as string | null;
      const focus_areas_raw = formData.get("focus_areas") as string | null;
      const focus_areas = focus_areas_raw ? JSON.parse(focus_areas_raw) : null;
      const contractId = crypto.randomUUID();
      const storageKey = orgId + "/" + contractId + "/" + file.name;
      const fileBytes = await file.arrayBuffer();
      const { error: storErr } = await admin.storage.from("contracts").upload(storageKey, fileBytes, { contentType: file.type });
      if (storErr) throw new AppError(ERROR_CODES.INTERNAL_ERROR, "Storage upload failed: " + storErr.message);
      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 90 * 86400000).toISOString();
      const { data, error } = await admin.from("contracts").insert({ id: contractId, org_id: orgId, uploaded_by: userId, file_name: file.name, file_type: ext, file_size_bytes: file.size, file_storage_key: storageKey, industry, contract_type, party_position, status: "uploaded", template_id: template_id ?? null, expires_at: expires, created_at: now }).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      await admin.from("analyses").insert({ contract_id: contractId, status: "parsing", progress_pct: 0, started_at: now, model_version: "claude-3-5-sonnet", focus_areas: focus_areas });
      await logAudit(admin, { orgId, userId, action: "upload", resourceType: "contract", resourceId: contractId });
      return created(data);
    }

    if (req.method === "GET" && segs.length === 1) {
      const contractId = validateUUID(segs[0], "contractId");
      await requireOrgRole(admin, orgId, userId, "viewer");
      const { data, error } = await admin.from("contracts").select("*, analyses(id,status,progress_pct,started_at,completed_at,duration_ms)").eq("id", contractId).eq("org_id", orgId).is("deleted_at", null).single();
      if (error || !data) throw new AppError(ERROR_CODES.NOT_FOUND, "Contract not found");
      return ok(data);
    }

    if (req.method === "DELETE" && segs.length === 1) {
      const contractId = validateUUID(segs[0], "contractId");
      await requireOrgRole(admin, orgId, userId, "member");
      const { data: contract } = await admin.from("contracts").select("file_storage_key").eq("id", contractId).eq("org_id", orgId).is("deleted_at", null).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND, "Contract not found");
      await admin.from("contracts").update({ deleted_at: new Date().toISOString() }).eq("id", contractId);
      await admin.storage.from("contracts").remove([contract.file_storage_key]);
      await logAudit(admin, { orgId, userId, action: "delete", resourceType: "contract", resourceId: contractId });
      return noContent();
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + rawPath);
  } catch (err) {
    return handleError(err);
  }
});
