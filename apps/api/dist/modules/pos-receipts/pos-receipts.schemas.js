"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posReceiptIdSchema = exports.posReceiptsListQuerySchema = void 0;
const zod_1 = require("zod");
exports.posReceiptsListQuerySchema = zod_1.z.object({
    storeId: zod_1.z.string().trim().min(1, "storeId requis"),
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional().default(50),
});
exports.posReceiptIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "id requis"),
});
