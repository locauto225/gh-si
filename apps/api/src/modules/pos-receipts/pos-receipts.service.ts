import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type { PosReceiptsListQuery } from "./pos-receipts.schemas";

export const posReceiptsService = {
  list: async (q: PosReceiptsListQuery) => {
    const items = await prisma.posReceipt.findMany({
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

  get: async (id: string) => {
    const item = await prisma.posReceipt.findUnique({
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
      throw new AppError("PosReceipt not found", {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return { item };
  },
};