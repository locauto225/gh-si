"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.ERROR_CODES = void 0;
exports.insufficientStockError = insufficientStockError;
exports.notFound = notFound;
exports.errorHandler = errorHandler;
// Standard error codes used across the API
exports.ERROR_CODES = {
    NOT_FOUND: "NOT_FOUND",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
    CONFLICT: "CONFLICT",
    DEPRECATED: "DEPRECATED",
};
class AppError extends Error {
    status;
    code;
    details;
    constructor(message, opts) {
        super(message);
        this.name = "AppError";
        this.status = opts?.status ?? 400;
        this.code = opts?.code ?? "APP_ERROR";
        this.details = opts?.details;
    }
}
exports.AppError = AppError;
function insufficientStockError(opts) {
    return new AppError("Stock insuffisant", {
        status: 409,
        code: exports.ERROR_CODES.INSUFFICIENT_STOCK,
        details: {
            available: opts?.available ?? null,
            requested: opts?.requested ?? null,
        },
    });
}
function notFound(_req, res) {
    res.status(404).json({ error: { code: exports.ERROR_CODES.NOT_FOUND, message: "Not found" } });
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        return res.status(err.status).json({
            error: { code: err.code, message: err.message, details: err.details ?? null },
        });
    }
    // Support ZodError (au cas où)
    if (typeof err === "object" && err && "name" in err && err.name === "ZodError") {
        return res.status(400).json({
            error: {
                code: exports.ERROR_CODES.VALIDATION_ERROR,
                message: "Invalid input",
                details: err.issues ?? null,
            },
        });
    }
    console.error("[api] unhandled error:", err);
    return res.status(500).json({
        error: { code: exports.ERROR_CODES.INTERNAL_ERROR, message: "Unexpected error" },
    });
}
