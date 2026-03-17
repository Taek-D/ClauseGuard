import { AppError, ERROR_CODES } from "./errors.ts";

export class ValidationError extends AppError {
  constructor(field: string, message: string) {
    super(ERROR_CODES.VALIDATION_ERROR, message, { field });
  }
}

export function validateRequired(value: unknown, field: string): void {
  if (value === undefined || value === null || value === "") {
    throw new ValidationError(field, `${field} is required`);
  }
}

export function validateString(
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number }
): string {
  validateRequired(value, field);
  if (typeof value !== "string") throw new ValidationError(field, `${field} must be a string`);
  if (opts?.min !== undefined && value.length < opts.min) {
    throw new ValidationError(field, `${field} must be at least ${opts.min} characters`);
  }
  if (opts?.max !== undefined && value.length > opts.max) {
    throw new ValidationError(field, `${field} must be at most ${opts.max} characters`);
  }
  return value;
}

export function validateEmail(value: unknown, field: string): string {
  const str = validateString(value, field, { max: 320 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    throw new ValidationError(field, `${field} must be a valid email`);
  }
  return str.toLowerCase();
}

export function validateEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): T {
  validateRequired(value, field);
  if (!allowed.includes(value as T)) {
    throw new ValidationError(field, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

export function validateUUID(value: unknown, field: string): string {
  const str = validateString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    throw new ValidationError(field, `${field} must be a valid UUID`);
  }
  return str;
}

export function validatePositiveInt(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(field, `${field} must be a positive integer`);
  }
  return n;
}

export function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new ValidationError(field, `${field} must be a boolean`);
  return value;
}

export async function validateBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Request body must be valid JSON");
  }
}
