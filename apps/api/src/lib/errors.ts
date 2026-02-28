import type { NextFunction, Request, Response } from "express";

// Standard error codes used across the API
export const ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  CONFLICT: "CONFLICT",
  DEPRECATED: "DEPRECATED",
} as const;

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    message: string,
    opts?: { status?: number; code?: string; details?: unknown }
  ) {
    super(message);
    this.name = "AppError";
    this.status = opts?.status ?? 400;
    this.code = opts?.code ?? "APP_ERROR";
    this.details = opts?.details;
  }
}

export function insufficientStockError(opts?: { available?: number; requested?: number }) {
  return new AppError("Stock insuffisant", {
    status: 409,
    code: ERROR_CODES.INSUFFICIENT_STOCK,
    details: {
      available: opts?.available ?? null,
      requested: opts?.requested ?? null,
    },
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: ERROR_CODES.NOT_FOUND, message: "Not found" } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
  }

  // Support ZodError (au cas où)
  if (typeof err === "object" && err && "name" in err && (err as any).name === "ZodError") {
    return res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Invalid input",
        details: (err as any).issues ?? null,
      },
    });
  }

  console.error("[api] unhandled error:", err);
  return res.status(500).json({
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: "Unexpected error" },
  });
}