"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopPaymentsService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
async function assertStopExists(stopId) {
    const stop = await prisma_1.prisma.deliveryStop.findUnique({
        where: { id: stopId },
        select: { id: true, tripId: true },
    });
    if (!stop) {
        throw new errors_1.AppError("Stop not found", {
            status: 404,
            code: errors_1.ERROR_CODES.NOT_FOUND,
            details: { stopId },
        });
    }
    return stop;
}
async function assertPaymentExists(id) {
    const item = await prisma_1.prisma.stopPayment.findUnique({
        where: { id },
        select: { id: true, stopId: true },
    });
    if (!item) {
        throw new errors_1.AppError("StopPayment not found", {
            status: 404,
            code: errors_1.ERROR_CODES.NOT_FOUND,
            details: { id },
        });
    }
    return item;
}
exports.stopPaymentsService = {
    list: async (q) => {
        await assertStopExists(q.stopId);
        const take = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 200);
        const items = await prisma_1.prisma.stopPayment.findMany({
            where: { stopId: q.stopId },
            orderBy: { createdAt: "desc" },
            take,
        });
        return { items };
    },
    create: async (input) => {
        await assertStopExists(input.stopId);
        const item = await prisma_1.prisma.stopPayment.create({
            data: {
                stopId: input.stopId,
                method: input.method,
                amount: input.amount,
                reference: input.reference ?? null,
                note: input.note ?? null,
                receivedAt: input.receivedAt ?? new Date(),
            },
        });
        return { item };
    },
    remove: async (id) => {
        const existing = await assertPaymentExists(id);
        await prisma_1.prisma.stopPayment.delete({
            where: { id: existing.id },
        });
        return { ok: true };
    },
};
