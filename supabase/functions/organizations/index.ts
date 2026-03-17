import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, noContent, preflight } from "../_shared/response.ts";
import { validateBody, validateString, validateEnum, validateEmail, validateUUID } from "../_shared/validators.ts";
import { verifyAuth, requireOrgRole, getOrgRole } from "../_shared/auth.ts";
import { logAudit } from "../_shared/audit.ts";
import { IndustryType, OrgRole } from "../_shared/types.ts";

const INDUSTRIES: readonly IndustryType[] = ["saas", "manufacturing", "realestate", "service", "other"];
const MUT_ROLES: readonly OrgRole[] = ["admin", "member", "viewer"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/functions\/v1\/organizations/, "") || "/";
  const segs = rawPath.split("/").filter(Boolean);

  try {
    const { userId, adminClient } = await verifyAuth(req);
    const admin = createAdminClient();
    if (!segs[0]) throw new AppError(ERROR_CODES.VALIDATION_ERROR, "orgId is required");
    const orgId = validateUUID(segs[0], "orgId");

    if (req.method === "GET" && segs.length === 1) {
      await requireOrgRole(admin, orgId, userId, "viewer");
      const { data, error } = await admin.from("organizations").select("*").eq("id", orgId).single();
      if (error || !data) throw new AppError(ERROR_CODES.NOT_FOUND, "Organization not found");
      return ok(data);
    }

    if (req.method === "PATCH" && segs.length === 1) {
      await requireOrgRole(admin, orgId, userId, "admin");
      const body = await validateBody<{ name?: string; industry?: string }>(req);
      const upd: Record<string, unknown> = {};
      if (body.name !== undefined) upd.name = validateString(body.name, "name", { min: 1, max: 200 });
      if (body.industry !== undefined) upd.industry = validateEnum(body.industry, "industry", INDUSTRIES);
      if (!Object.keys(upd).length) throw new AppError(ERROR_CODES.VALIDATION_ERROR, "No fields to update");
      upd.updated_at = new Date().toISOString();
      const { data, error } = await admin.from("organizations").update(upd).eq("id", orgId).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data);
    }

    if (req.method === "GET" && segs[1] === "members" && segs.length === 2) {
      await requireOrgRole(admin, orgId, userId, "viewer");
      const { data, error } = await admin.from("org_members").select("*, users(id,email,name)").eq("org_id", orgId).neq("status", "deactivated");
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data);
    }

    if (req.method === "POST" && segs[1] === "invite" && segs.length === 2) {
      await requireOrgRole(admin, orgId, userId, "admin");
      const body = await validateBody<{ email: string; role: string }>(req);
      const email = validateEmail(body.email, "email");
      const role = validateEnum(body.role as OrgRole, "role", MUT_ROLES);
      const { data: org } = await admin.from("organizations").select("plan").eq("id", orgId).single();
      if (org?.plan === "team") {
        const { data: sub } = await admin.from("subscriptions").select("seat_limit").eq("org_id", orgId).single();
        if (sub) {
          const { count } = await admin.from("org_members").select("id", { count: "exact" }).eq("org_id", orgId).eq("status", "active");
          if ((count ?? 0) >= sub.seat_limit) throw new AppError(ERROR_CODES.ORG_SEAT_LIMIT, "Seat limit reached");
        }
      }
      const token = crypto.randomUUID();
      const { data, error } = await admin.from("org_members").insert({ org_id: orgId, user_id: null, role, status: "pending", invited_at: new Date().toISOString(), invite_email: email, invite_token: token }).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      await logAudit(admin, { orgId, userId, action: "invite", resourceType: "org_member", resourceId: data.id, metadata: { email, role } });
      return ok({ member: data, invite_token: token });
    }

    if (req.method === "POST" && segs[1] === "invite" && segs[2] === "accept" && segs.length === 3) {
      const body = await validateBody<{ token: string }>(req);
      const { data: inv, error } = await admin.from("org_members").select("*").eq("org_id", orgId).eq("invite_token", body.token).eq("status", "pending").single();
      if (error || !inv) throw new AppError(ERROR_CODES.NOT_FOUND, "Invite not found or already used");
      const { data, error: ue } = await admin.from("org_members").update({ user_id: userId, status: "active", joined_at: new Date().toISOString() }).eq("id", inv.id).select().single();
      if (ue) throw new AppError(ERROR_CODES.INTERNAL_ERROR, ue.message);
      return ok(data);
    }

    if (req.method === "PATCH" && segs[1] === "members" && segs[2] && segs.length === 3) {
      await requireOrgRole(admin, orgId, userId, "admin");
      const memberId = validateUUID(segs[2], "memberId");
      const body = await validateBody<{ role: string }>(req);
      const role = validateEnum(body.role as OrgRole, "role", MUT_ROLES);
      const { data: tgt } = await admin.from("org_members").select("role").eq("id", memberId).single();
      if (tgt?.role === "owner") throw new AppError(ERROR_CODES.FORBIDDEN, "Cannot change owner role");
      const callerRole = await getOrgRole(admin, orgId, userId);
      if (callerRole !== "owner" && role === "admin") throw new AppError(ERROR_CODES.FORBIDDEN, "Only owners can assign admin role");
      const { data, error } = await admin.from("org_members").update({ role }).eq("id", memberId).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      await logAudit(admin, { orgId, userId, action: "role_change", resourceType: "org_member", resourceId: memberId, metadata: { new_role: role } });
      return ok(data);
    }

    if (req.method === "DELETE" && segs[1] === "members" && segs[2] && segs.length === 3) {
      await requireOrgRole(admin, orgId, userId, "admin");
      const memberId = validateUUID(segs[2], "memberId");
      const { data: tgt } = await admin.from("org_members").select("role").eq("id", memberId).single();
      if (tgt?.role === "owner") throw new AppError(ERROR_CODES.FORBIDDEN, "Cannot remove owner");
      await admin.from("org_members").update({ status: "deactivated" }).eq("id", memberId);
      return noContent();
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + rawPath);
  } catch (err) {
    return handleError(err);
  }
});
