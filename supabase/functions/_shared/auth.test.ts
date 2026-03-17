import { assertEquals, assertRejects } from "jsr:@std/assert";

import { AppError, ERROR_CODES } from "./errors.ts";
import {
  getOrgRole,
  getUserOrgId,
  requireOrgRole,
  requirePlan,
} from "./auth.ts";

function createQuery(result: unknown) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    single: async () => result,
  };

  return query;
}

function createClient(tableName: string, result: unknown) {
  return {
    from(name: string) {
      assertEquals(name, tableName);
      return createQuery(result);
    },
  } as const;
}

Deno.test("getUserOrgId returns the active organization id", async () => {
  const client = createClient("org_members", {
    data: { org_id: "org-1" },
    error: null,
  });

  assertEquals(await getUserOrgId(client as never, "user-1"), "org-1");
});

Deno.test("getUserOrgId rejects when the user has no active organization", async () => {
  const client = createClient("org_members", {
    data: null,
    error: { message: "not found" },
  });

  await assertRejects(
    () => getUserOrgId(client as never, "user-1"),
    AppError,
    "No active organization found for user",
  );
});

Deno.test("getOrgRole returns null when no membership is found", async () => {
  const client = createClient("org_members", {
    data: null,
    error: null,
  });

  assertEquals(await getOrgRole(client as never, "org-1", "user-1"), null);
});

Deno.test("requireOrgRole allows higher-ranked roles and rejects weaker roles", async () => {
  const ownerClient = createClient("org_members", {
    data: { role: "owner" },
    error: null,
  });
  await requireOrgRole(ownerClient as never, "org-1", "user-1", "admin");

  const viewerClient = createClient("org_members", {
    data: { role: "viewer" },
    error: null,
  });
  await assertRejects(
    () => requireOrgRole(viewerClient as never, "org-1", "user-1", "member"),
    AppError,
    "Requires at least member role",
  );
});

Deno.test("requirePlan enforces minimum organization plans", async () => {
  const allowedClient = createClient("organizations", {
    data: { plan: "team" },
    error: null,
  });
  await requirePlan(allowedClient as never, "org-1", "professional");

  const blockedClient = createClient("organizations", {
    data: { plan: "free" },
    error: null,
  });
  const err = await assertRejects(
    () => requirePlan(blockedClient as never, "org-1", "starter"),
    AppError,
  );
  assertEquals(err.code, ERROR_CODES.PLAN_LIMIT_EXCEEDED);
});
