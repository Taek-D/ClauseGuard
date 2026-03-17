import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, noContent, created, preflight } from "../_shared/response.ts";
import { validateBody, validateString, validateEnum } from "../_shared/validators.ts";
import { verifyAuth, getUserOrgId, requirePlan } from "../_shared/auth.ts";
import { UserLanguage, RolePreference } from "../_shared/types.ts";

const LANGS: readonly UserLanguage[] = ["ko", "en"];
const ROLES: readonly RolePreference[] = ["executive", "legal", "sales", "freelancer"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const path = new URL(req.url).pathname.replace(/^\/functions\/v1\/users/, "") || "/";

  try {
    const { userId, adminClient } = await verifyAuth(req);
    const admin = createAdminClient();

    if (req.method === "GET" && path === "/me") {
      const { data, error } = await admin
        .from("users")
        .select("id,email,name,auth_provider,role_preference,mfa_enabled,language,created_at,last_login_at")
        .eq("id", userId).single();
      if (error || !data) throw new AppError(ERROR_CODES.NOT_FOUND, "User not found");
      return ok(data);
    }

    if (req.method === "PATCH" && path === "/me") {
      const body = await validateBody<{ name?: string; language?: string; role_preference?: string }>(req);
      const upd: Record<string, unknown> = {};
      if (body.name !== undefined) upd.name = validateString(body.name, "name", { min: 1, max: 100 });
      if (body.language !== undefined) upd.language = validateEnum(body.language, "language", LANGS);
      if (body.role_preference !== undefined) upd.role_preference = validateEnum(body.role_preference, "role_preference", ROLES);
      if (!Object.keys(upd).length) throw new AppError(ERROR_CODES.VALIDATION_ERROR, "No fields to update");
      const { data, error } = await admin.from("users").update(upd).eq("id", userId).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data);
    }

    if (req.method === "DELETE" && path === "/me") {
      const body = await validateBody<{ confirm: string }>(req);
      if (body.confirm !== "DELETE") throw new AppError(ERROR_CODES.VALIDATION_ERROR, "confirm must be DELETE");
      await admin.auth.admin.deleteUser(userId);
      return noContent();
    }

    if (req.method === "GET" && path === "/me/api-key") {
      const orgId = await getUserOrgId(adminClient, userId);
      await requirePlan(adminClient, orgId, "professional");
      const { data } = await admin.from("api_keys").select("key_prefix,created_at").eq("user_id", userId).maybeSingle();
      return ok(data ?? { key: null, created_at: null });
    }

    if (req.method === "POST" && path === "/me/api-key") {
      const orgId = await getUserOrgId(adminClient, userId);
      await requirePlan(adminClient, orgId, "professional");
      const rawKey = "cg_live_" + crypto.randomUUID().replace(/-/g, "");
      await admin.from("api_keys").upsert({ user_id: userId, key: rawKey, key_prefix: rawKey.slice(0, 16) });
      return created({ key: rawKey });
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + path);
  } catch (err) {
    return handleError(err);
  }
});
