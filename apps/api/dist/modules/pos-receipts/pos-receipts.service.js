"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posReceiptsService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
exports.posReceiptsService = {
    list: async (q) => {
        const items = await prisma_1.prisma.posReceipt.findMany({
            where: { storeId: q.storeId },
            orderBy: { createdAt: "desc" },
            take: q.limit,
            include: {
                store: { select: { id: true, name: true } },
                sale: {
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        channel: true,
                        fulfillment: true,
                        shippingFee: true,
                        totalHT: true,
                        totalTTC: true,
                        amountPaid: true,
                        postedAt: true,
                        client: { select: { id: true, name: true } },
                    },
                },
            },
        });
        return { items };
    },
    get: async (id) => {
        const item = await prisma_1.prisma.posReceipt.findUnique({
            where: { id },
            include: {
                store: { select: { id: true, name: true } },
                sale: {
                    include: {
                        client: true,
                        warehouse: true,
                        lines: { include: { product: true } },
                        payments: true,
                    },
                },
            },
        });
        if (!item) {
            throw new errors_1.AppError("PosReceipt not found", {
                status: 404,
                code: errors_1.ERROR_CODES.NOT_FOUND,
            });
        }
        return { item };
    },
};
