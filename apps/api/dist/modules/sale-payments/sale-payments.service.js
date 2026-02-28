"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salePaymentsService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function computePaymentStatus(totalTTC, amountPaid) {
    if (amountPaid <= 0)
        return "UNPAID";
    if (amountPaid < totalTTC)
        return "PARTIAL";
    return "PAID";
}
exports.salePaymentsService = {
    listForSale: async (saleId) => {
        const items = await prisma_1.prisma.payment.findMany({
            where: { saleId },
            orderBy: { createdAt: "desc" },
            take: 200,
        });
        return { items };
    },
    createForSale: async (saleId, body) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findUnique({
                where: { id: saleId },
                select: {
                    id: true,
                    status: true,
                    totalTTC: true,
                    clientId: true,
                    warehouseId: true,
                    storeId: true,
                },
            });
            if (!sale) {
                throw new errors_1.AppError("Sale not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            }
            if (sale.status === "CANCELLED") {
                throw new errors_1.AppError("Sale cancelled", { status: 409, code: errors_1.ERROR_CODES.CONFLICT });
            }
            const receivedAt = body.receivedAt ?? new Date();
            const payment = await tx.payment.create({
                data: {
                    method: body.method,
                    amount: body.amount,
                    reference: body.reference ?? null,
                    note: body.note ?? null,
                    receivedAt,
                    saleId: sale.id,
                    clientId: sale.clientId ?? null,
                    warehouseId: sale.warehouseId ?? null,
                    storeId: sale.storeId ?? null,
                },
            });
            // Recalcul snapshot sur la vente (source of truth = somme des payments)
            const agg = await tx.payment.aggregate({
                where: { saleId: sale.id },
                _sum: { amount: true },
            });
            const amountPaid = agg._sum.amount ?? 0;
            const paymentStatus = computePaymentStatus(sale.totalTTC ?? 0, amountPaid);
            const updatedSale = await tx.sale.update({
                where: { id: sale.id },
                data: {
                    amountPaid,
                    paymentStatus,
                },
                select: { id: true, amountPaid: true, paymentStatus: true },
            });
            return { item: payment, sale: updatedSale };
        });
    },
};
