"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const errors_1 = require("./errors");
function validate(schema, data) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        throw new errors_1.AppError("Validation failed", {
            status: 400,
            code: errors_1.ERROR_CODES.VALIDATION_ERROR,
            details: parsed.error.issues,
        });
    }
    return parsed.data;
}
