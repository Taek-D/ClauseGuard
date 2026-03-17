import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AuditAction } from "./types.ts";

interface AuditParams {
  orgId: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(adminClient: SupabaseClient, params: AuditParams): Promise<void> {
  try {
    await adminClient.from("audit_logs").insert({
      org_id: params.orgId,
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}
