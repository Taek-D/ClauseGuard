export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  PLAN_LIMIT_EXCEEDED: "PLAN_LIMIT_EXCEEDED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  ANALYSIS_IN_PROGRESS: "ANALYSIS_IN_PROGRESS",
  MFA_REQUIRED: "MFA_REQUIRED",
  INVALID_MFA_CODE: "INVALID_MFA_CODE",
  ORG_SEAT_LIMIT: "ORG_SEAT_LIMIT",
  SHARE_LINK_EXPIRED: "SHARE_LINK_EXPIRED",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  PLAN_LIMIT_EXCEEDED: 402,
  FILE_TOO_LARGE: 413,
  INVALID_FILE_TYPE: 415,
  ANALYSIS_IN_PROGRESS: 409,
  MFA_REQUIRED: 403,
  INVALID_MFA_CODE: 400,
  ORG_SEAT_LIMIT: 402,
  SHARE_LINK_EXPIRED: 410,
  METHOD_NOT_ALLOWED: 405,
};

export class AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = STATUS_MAP[code] ?? 500;
    this.details = details;
    this.name = "AppError";
  }
}

export function handleError(err: unknown): Response {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { code: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return new Response(JSON.stringify({ error: body }), {
      status: err.statusCode,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  console.error("[unhandled error]", err);
  return new Response(
    JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } }),
    { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
}
