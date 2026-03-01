"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderSetStatusSchema = exports.orderCreateSchema = exports.orderQuoteSchema = exports.orderLineInputSchema = exports.ordersListQuerySchema = exports.orderIdParamsSchema = void 0;
const zod_1 = require("zod");
exports.orderIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "id requis"),
});
exports.ordersListQuerySchema = zod_1.z.object({
    status: zod_1.z
        .enum(["all", "DRAFT", "CONFIRMED", "PREPARED", "SHIPPED", "DELIVERED", "CANCELLED"])
        .optional()
        .default("all"),
    logisticsStatus: zod_1.z
        .enum(["all", "NO_BL", "TO_PREPARE", "IN_PROGRESS", "PARTIAL", "DONE", "CANCELLED"])
        .optional()
        .default("all"),
    hasRemaining: zod_1.z
        .enum(["all", "yes", "no"])
        .optional()
        .default("all"),
    nextAction: zod_1.z
        .enum(["all", "CONFIRM", "PREPARE", "CREATE_BL", "DISPATCH", "DELIVER_REMAINDER", "CLOSE_ORDER"])
        .optional()
        .default("all"),
    warehouseId: zod_1.z.string().trim().min(1).optional(),
    clientId: zod_1.z.string().trim().min(1).optional(),
    q: zod_1.z.string().trim().max(200).optional(),
    sortBy: zod_1.z
        .enum(["createdAt", "status", "logisticsStatus", "deliveriesCount"])
        .optional()
        .default("createdAt"),
    sortDir: zod_1.z.enum(["asc", "desc"]).optional().default("desc"),
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional().default(50),
});
exports.orderLineInputSchema = zod_1.z.object({
    productId: zod_1.z.string().trim().min(1),
    qty: zod_1.z.coerce.number().int().min(1),
    unitPrice: zod_1.z.coerce.number().int().min(0).optional(), // si absent => pricing (pricelist ou product.price)
});
exports.orderQuoteSchema = zod_1.z.object({
    warehouseId: zod_1.z.string().trim().min(1),
    clientId: zod_1.z.string().trim().min(1).optional().nullable(),
    lines: zod_1.z.array(exports.orderLineInputSchema).min(1),
});
exports.orderCreateSchema = zod_1.z.object({
    warehouseId: zod_1.z.string().trim().min(1),
    clientId: zod_1.z.string().trim().min(1).optional().nullable(),
    note: zod_1.z.string().trim().max(2000).optional().nullable(),
    fulfillment: zod_1.z.enum(["PICKUP", "DELIVERY"]).optional().default("PICKUP"),
    shippingFee: zod_1.z.coerce.number().int().min(0).optional().default(0),
    lines: zod_1.z.array(exports.orderLineInputSchema).min(1),
});
exports.orderSetStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(["CONFIRMED", "PREPARED", "SHIPPED", "DELIVERED", "CANCELLED"]),
});
