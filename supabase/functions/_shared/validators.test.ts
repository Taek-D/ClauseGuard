import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert";

import { AppError, ERROR_CODES } from "./errors.ts";
import {
  validateBody,
  validateBoolean,
  validateEmail,
  validateEnum,
  validatePositiveInt,
  validateRequired,
  validateString,
  validateUUID,
} from "./validators.ts";

Deno.test("validateRequired rejects undefined, null, and empty strings", () => {
  for (const value of [undefined, null, ""]) {
    const err = assertThrows(
      () => validateRequired(value, "field"),
      AppError,
    );
    assertEquals(err.code, ERROR_CODES.VALIDATION_ERROR);
  }
});

Deno.test("validateString enforces type and length", () => {
  assertEquals(validateString("ClauseGuard", "name", { min: 1, max: 20 }), "ClauseGuard");

  const typeError = assertThrows(() => validateString(42, "name"), AppError);
  assertEquals(typeError.code, ERROR_CODES.VALIDATION_ERROR);

  const minError = assertThrows(
    () => validateString("a", "name", { min: 2 }),
    AppError,
  );
  assertEquals(minError.code, ERROR_CODES.VALIDATION_ERROR);
});

Deno.test("validateEmail normalizes valid emails and rejects invalid ones", () => {
  assertEquals(validateEmail("User@Example.COM", "email"), "user@example.com");

  const err = assertThrows(
    () => validateEmail("not-an-email", "email"),
    AppError,
  );
  assertEquals(err.code, ERROR_CODES.VALIDATION_ERROR);
});

Deno.test("validateEnum and validateUUID accept expected inputs", () => {
  assertEquals(validateEnum("team", "plan", ["free", "team"] as const), "team");
  assertEquals(
    validateUUID("123e4567-e89b-12d3-a456-426614174000", "id"),
    "123e4567-e89b-12d3-a456-426614174000",
  );
});

Deno.test("validatePositiveInt and validateBoolean reject invalid values", () => {
  assertEquals(validatePositiveInt("3", "count"), 3);
  assertEquals(validateBoolean(true, "accepted"), true);

  const intError = assertThrows(
    () => validatePositiveInt("3.5", "count"),
    AppError,
  );
  assertEquals(intError.code, ERROR_CODES.VALIDATION_ERROR);

  const boolError = assertThrows(
    () => validateBoolean("true", "accepted"),
    AppError,
  );
  assertEquals(boolError.code, ERROR_CODES.VALIDATION_ERROR);
});

Deno.test("validateBody parses JSON, returns an empty object for empty bodies, and rejects invalid JSON", async () => {
  const parsed = await validateBody<{ ok: boolean }>(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    }),
  );
  assertEquals(parsed, { ok: true });

  const empty = await validateBody(new Request("https://example.com", { method: "POST" }));
  assertEquals(empty, {});

  await assertRejects(
    () =>
      validateBody(
        new Request("https://example.com", {
          method: "POST",
          body: "{bad-json",
        }),
      ),
    AppError,
    "Request body must be valid JSON",
  );
});
