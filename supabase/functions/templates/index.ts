import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, created, noContent, preflight } from "../_shared/response.ts";
import { validateBody, validateString, validateEnum, validateUUID } from "../_shared/validators.ts";
import { verifyAuth, getUserOrgId, requirePlan } from "../_shared/auth.ts";
import { IndustryType, ContractType, ClauseCategory, Severity } from "../_shared/types.ts";

const INDUSTRIES: readonly IndustryType[] = ["saas","manufacturing","realestate","service","other"];
const CONTRACT_TYPES: readonly ContractType[] = ["subscription","nda","service","partnership","lease","other"];
const CLAUSE_CATS: readonly ClauseCategory[] = ["liability","termination","renewal","ip","indemnity","confidentiality","payment","other"];
const SEVERITIES: readonly Severity[] = ["high","medium","low"];

interface RuleInput { clause_category: string; rule_description: string; severity_if_violated: string; benchmark_text?: string; order_index?: number; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/functions\/v1\/templates/, "") || "/";
  const segs = rawPath.split("/").filter(Boolean);

  try {
    const { userId, adminClient } = await verifyAuth(req);
    const admin = createAdminClient();
    const orgId = await getUserOrgId(adminClient, userId);

    if (req.method === "GET" && segs.length === 0) {
      const industry = url.searchParams.get("industry");
      const contractType = url.searchParams.get("contract_type");
      const isSystem = url.searchParams.get("is_system");
      let q = admin.from("templates").select("*").or("is_system.eq.true,org_id.eq." + orgId);
      if (industry) q = q.eq("industry", industry);
      if (contractType) q = q.eq("contract_type", contractType);
      if (isSystem === "true") q = q.eq("is_system", true);
      else if (isSystem === "false") q = q.eq("is_system", false);
      const { data, error } = await q.order("is_system", { ascending: false }).order("created_at");
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data);
    }

    if (req.method === "POST" && segs.length === 0) {
      await requirePlan(adminClient, orgId, "professional");
      const body = await validateBody<{ name: string; industry: string; contract_type: string; base_template_id?: string; rules?: RuleInput[] }>(req);
      const name = validateString(body.name, "name", { min: 1, max: 200 });
      const industry = validateEnum(body.industry, "industry", INDUSTRIES);
      const contract_type = validateEnum(body.contract_type, "contract_type", CONTRACT_TYPES);
      const rules = (body.rules ?? []).map((r, i) => ({ clause_category: validateEnum(r.clause_category, "clause_category", CLAUSE_CATS), rule_description: validateString(r.rule_description, "rule_description", { min: 1 }), severity_if_violated: validateEnum(r.severity_if_violated, "severity_if_violated", SEVERITIES), benchmark_text: r.benchmark_text ?? null, order_index: r.order_index ?? i }));
      const now = new Date().toISOString();
      const { data: tmpl, error } = await admin.from("templates").insert({ org_id: orgId, name, industry, contract_type, is_system: false, base_template_id: body.base_template_id ?? null, rule_count: rules.length, created_at: now, updated_at: now }).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      if (rules.length > 0) await admin.from("template_rules").insert(rules.map(r => ({ ...r, template_id: tmpl.id })));
      const { data: full } = await admin.from("templates").select("*, template_rules(*)").eq("id", tmpl.id).single();
      return created(full);
    }

    if (req.method === "GET" && segs.length === 1) {
      const tmplId = validateUUID(segs[0], "templateId");
      const { data, error } = await admin.from("templates").select("*, template_rules(*)").eq("id", tmplId).single();
      if (error || !data) throw new AppError(ERROR_CODES.NOT_FOUND, "Template not found");
      if (!data.is_system && data.org_id !== orgId) throw new AppError(ERROR_CODES.FORBIDDEN, "Access denied");
      return ok(data);
    }

    if (req.method === "PATCH" && segs.length === 1) {
      const tmplId = validateUUID(segs[0], "templateId");
      const { data: existing } = await admin.from("templates").select("is_system,org_id").eq("id", tmplId).single();
      if (!existing) throw new AppError(ERROR_CODES.NOT_FOUND, "Template not found");
      if (existing.is_system) throw new AppError(ERROR_CODES.FORBIDDEN, "Cannot modify system templates");
      if (existing.org_id !== orgId) throw new AppError(ERROR_CODES.FORBIDDEN, "Access denied");
      const body = await validateBody<{ name?: string; rules?: RuleInput[] }>(req);
      const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) upd.name = validateString(body.name, "name", { min: 1, max: 200 });
      await admin.from("templates").update(upd).eq("id", tmplId);
      if (body.rules !== undefined) {
        await admin.from("template_rules").delete().eq("template_id", tmplId);
        const rules = body.rules.map((r, i) => ({ template_id: tmplId, clause_category: validateEnum(r.clause_category, "clause_category", CLAUSE_CATS), rule_description: validateString(r.rule_description, "rule_description", { min: 1 }), severity_if_violated: validateEnum(r.severity_if_violated, "severity_if_violated", SEVERITIES), benchmark_text: r.benchmark_text ?? null, order_index: r.order_index ?? i }));
        if (rules.length > 0) {
          await admin.from("template_rules").insert(rules);
          await admin.from("templates").update({ rule_count: rules.length }).eq("id", tmplId);
        }
      }
      const { data } = await admin.from("templates").select("*, template_rules(*)").eq("id", tmplId).single();
      return ok(data);
    }

    if (req.method === "DELETE" && segs.length === 1) {
      const tmplId = validateUUID(segs[0], "templateId");
      const { data: existing } = await admin.from("templates").select("is_system,org_id").eq("id", tmplId).single();
      if (!existing) throw new AppError(ERROR_CODES.NOT_FOUND, "Template not found");
      if (existing.is_system) throw new AppError(ERROR_CODES.FORBIDDEN, "Cannot delete system templates");
      if (existing.org_id !== orgId) throw new AppError(ERROR_CODES.FORBIDDEN, "Access denied");
      await admin.from("template_rules").delete().eq("template_id", tmplId);
      await admin.from("templates").delete().eq("id", tmplId);
      return noContent();
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + rawPath);
  } catch (err) {
    return handleError(err);
  }
});
