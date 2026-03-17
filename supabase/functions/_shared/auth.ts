import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AppError, ERROR_CODES } from "./errors.ts";
import { createAdminClient, createUserClient } from "./db.ts";
import { OrgRole, PlanType } from "./types.ts";

const ROLE_RANK: Record<OrgRole, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };
const PLAN_RANK: Record<PlanType, number> = { free: 0, starter: 1, professional: 2, team: 3 };

export async function verifyAuth(req: Request): Promise<{
  userId: string;
  supabase: SupabaseClient;
  adminClient: SupabaseClient;
}> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice(7);
  const supabase = createUserClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid or expired token");
  }
  return { userId: user.id, supabase, adminClient: createAdminClient() };
}

export async function getUserOrgId(adminClient: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await adminClient
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("invited_at", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "No active organization found for user");
  }
  return data.org_id as string;
}

export async function getOrgRole(
  adminClient: SupabaseClient,
  orgId: string,
  userId: string
): Promise<OrgRole | null> {
  const { data } = await adminClient
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();
  return (data?.role as OrgRole) ?? null;
}

export async function requireOrgRole(
  adminClient: SupabaseClient,
  orgId: string,
  userId: string,
  minRole: OrgRole
): Promise<void> {
  const role = await getOrgRole(adminClient, orgId, userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new AppError(ERROR_CODES.FORBIDDEN, `Requires at least ${minRole} role`);
  }
}

export async function requirePlan(
  adminClient: SupabaseClient,
  orgId: string,
  minPlan: PlanType
): Promise<void> {
  const { data, error } = await adminClient
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();
  if (error || !data) throw new AppError(ERROR_CODES.NOT_FOUND, "Organization not found");
  if (PLAN_RANK[data.plan as PlanType] < PLAN_RANK[minPlan]) {
    throw new AppError(
      ERROR_CODES.PLAN_LIMIT_EXCEEDED,
      `This feature requires ${minPlan} plan or higher`
    );
  }
}
