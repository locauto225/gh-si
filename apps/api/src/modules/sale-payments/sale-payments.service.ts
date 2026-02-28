import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type { SalePaymentCreateBody } from "./sale-payments.schemas";

function computePaymentStatus(totalTTC: number, amountPaid: number) {
  if (amountPaid <= 0) return "UNPAID" as const;
  if (amountPaid < totalTTC) return "PARTIAL" as const;
  return "PAID" as const;
}

export const salePaymentsService = {
  listForSale: async (saleId: string) => {
    const items = await prisma.payment.findMany({
      where: { saleId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { items };
  },

  createForSale: async (saleId: string, body: SalePaymentCreateBody) => {
    return prisma.$transaction(async (tx) => {
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
        throw new AppError("Sale not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      }

      if (sale.status === "CANCELLED") {
        throw new AppError("Sale cancelled", { status: 409, code: ERROR_CODES.CONFLICT });
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