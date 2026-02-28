import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type {
  StopPaymentCreateInput,
  StopPaymentsListQuery,
} from "./stop-payments.schemas";

async function assertStopExists(stopId: string) {
  const stop = await prisma.deliveryStop.findUnique({
    where: { id: stopId },
    select: { id: true, tripId: true },
  });
  if (!stop) {
    throw new AppError("Stop not found", {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      details: { stopId },
    });
  }
  return stop;
}

async function assertPaymentExists(id: string) {
  const item = await prisma.stopPayment.findUnique({
    where: { id },
    select: { id: true, stopId: true },
  });
  if (!item) {
    throw new AppError("StopPayment not found", {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      details: { id },
    });
  }
  return item;
}

export const stopPaymentsService = {
  list: async (q: StopPaymentsListQuery) => {
    await assertStopExists(q.stopId);

    const take = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 200);

    const items = await prisma.stopPayment.findMany({
      where: { stopId: q.stopId },
      orderBy: { createdAt: "desc" },
      take,
    });

    return { items };
  },

  create: async (input: StopPaymentCreateInput) => {
    await assertStopExists(input.stopId);

    const item = await prisma.stopPayment.create({
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

  remove: async (id: string) => {
    const existing = await assertPaymentExists(id);

    await prisma.stopPayment.delete({
      where: { id: existing.id },
    });

    return { ok: true };
  },
};