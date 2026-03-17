import { assertEquals } from "jsr:@std/assert";

import { AppError, ERROR_CODES, handleError } from "./errors.ts";

Deno.test("AppError assigns the mapped HTTP status code", () => {
  const err = new AppError(ERROR_CODES.NOT_FOUND, "missing");
  assertEquals(err.statusCode, 404);
});

Deno.test("handleError serializes AppError responses", async () => {
  const response = handleError(
    new AppError(ERROR_CODES.CONFLICT, "duplicate", { id: "123" }),
  );

  assertEquals(response.status, 409);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await response.json(), {
    error: {
      code: "CONFLICT",
      message: "duplicate",
      details: { id: "123" },
    },
  });
});

Deno.test("handleError hides unexpected internal errors", async () => {
  const response = handleError(new Error("database exploded"));

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
});
