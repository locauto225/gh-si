import type { ZodSchema } from "zod";
import { AppError, ERROR_CODES } from "./errors";

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError("Validation failed", {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      details: parsed.error.issues,
    });
  }
  return parsed.data;
}