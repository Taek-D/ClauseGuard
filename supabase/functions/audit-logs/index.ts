import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, preflight } from "../_shared/response.ts";
import { verifyAuth, getUserOrgId, requireOrgRole, requirePlan } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);

  try {
    const { userId, adminClient } = await verifyAuth(req);
    const admin = createAdminClient();
    const orgId = await getUserOrgId(adminClient, userId);

    if (req.method !== "GET") {
      throw new AppError(ERROR_CODES.METHOD_NOT_ALLOWED, "Method not allowed");
    }

    await requireOrgRole(admin, orgId, userId, "admin");

    const { data: org } = await admin.from("organizations").select("plan").eq("id", orgId).single();
    const plan = org?.plan ?? "free";
    if (plan === "free" || plan === "starter") {
      throw new AppError(ERROR_CODES.PLAN_LIMIT_EXCEEDED, "Audit logs require Professional or Team plan");
    }

    const retentionDays = plan === "team" ? 365 : 90;
    const since = new Date(Date.now() - retentionDays * 86400000).toISOString();

    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
    const offset = (page - 1) * limit;

    let q = admin.from("audit_logs")
      .select("*, users(id,name,email)", { count: "exact" })
      .eq("org_id", orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const action = url.searchParams.get("action");
    const userId2 = url.searchParams.get("user_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (action) q = q.eq("action", action);
    if (userId2) q = q.eq("user_id", userId2);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);

    const { data, error, count } = await q;
    if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
    return ok(data, { total: count ?? 0, page, limit, retention_days: retentionDays });
  } catch (err) {
    return handleError(err);
  }
});
