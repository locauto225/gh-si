import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type { InvoicePaymentCreateBody } from "./invoice-payments.schemas";

function computePaymentStatus(totalTTC: number, amountPaid: number) {
  if (amountPaid <= 0) return "UNPAID" as const;
  if (amountPaid < totalTTC) return "PARTIAL" as const;
  return "PAID" as const;
}

export const invoicePaymentsService = {
  listForInvoice: async (invoiceId: string) => {
    const items = await prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { items };
  },

  createForInvoice: async (invoiceId: string, body: InvoicePaymentCreateBody) => {
    return prisma.$transaction(async (tx) => {
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
        throw new AppError("Invoice not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      }

      if (invoice.status === "CANCELLED") {
        throw new AppError("Invoice cancelled", { status: 409, code: ERROR_CODES.CONFLICT });
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