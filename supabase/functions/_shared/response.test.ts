import { assertEquals } from "jsr:@std/assert";

import { created, noContent, ok, preflight } from "./response.ts";

Deno.test("ok wraps data and optional metadata in a JSON response", async () => {
  const response = ok({ id: "contract-1" }, { page: 2 });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(await response.json(), {
    data: { id: "contract-1" },
    meta: { page: 2 },
  });
});

Deno.test("created returns HTTP 201 with the provided payload", async () => {
  const response = created({ id: "report-1" });

  assertEquals(response.status, 201);
  assertEquals(await response.json(), { data: { id: "report-1" } });
});

Deno.test("noContent and preflight return empty 204 responses with CORS headers", () => {
  const empty = noContent();
  const options = preflight();

  assertEquals(empty.status, 204);
  assertEquals(options.status, 204);
  assertEquals(empty.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(options.headers.get("Access-Control-Allow-Methods"), "GET, POST, PATCH, DELETE, OPTIONS");
});
