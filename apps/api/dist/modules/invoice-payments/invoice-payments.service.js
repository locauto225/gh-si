"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoicePaymentsService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function computePaymentStatus(totalTTC, amountPaid) {
    if (amountPaid <= 0)
        return "UNPAID";
    if (amountPaid < totalTTC)
        return "PARTIAL";
    return "PAID";
}
exports.invoicePaymentsService = {
    listForInvoice: async (invoiceId) => {
        const items = await prisma_1.prisma.payment.findMany({
            where: { invoiceId },
            orderBy: { createdAt: "desc" },
            take: 200,
        });
        return { items };
    },
    createForInvoice: async (invoiceId, body) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                select: {
                    id: true,
                    status: true,
                    totalTTC: true,
                    clientId: true,
                    warehouseId: true,
                    storeId: true,
                },
            });
            if (!invoice) {
                throw new errors_1.AppError("Invoice not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            }
            if (invoice.status === "CANCELLED") {
                throw new errors_1.AppError("Invoice cancelled", { status: 409, code: errors_1.ERROR_CODES.CONFLICT });
            }
            const receivedAt = body.receivedAt ?? new Date();
            const payment = await tx.payment.create({
                data: {
                    method: body.method,
                    amount: body.amount,
                    reference: body.reference ?? null,
                    note: body.note ?? null,
                    receivedAt,
                    invoiceId: invoice.id,
                    clientId: invoice.clientId ?? null,
                    warehouseId: invoice.warehouseId ?? null,
                    storeId: invoice.storeId ?? null,
                },
            });
            // Recalcul snapshot sur la facture
            const agg = await tx.payment.aggregate({
                where: { invoiceId: invoice.id },
                _sum: { amount: true },
            });
            const amountPaid = agg._sum.amount ?? 0;
            const paymentStatus = computePaymentStatus(invoice.totalTTC ?? 0, amountPaid);
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    amountPaid,
                    paymentStatus,
                },
                select: { id: true, amountPaid: true, paymentStatus: true },
            });
            return { item: payment, invoice: updatedInvoice };
        });
    },
};
