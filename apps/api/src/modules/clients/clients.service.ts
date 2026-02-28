import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type {
  ClientCreateInput,
  ClientUpdateInput,
  ClientsListQuery,
} from "./clients.schemas";

function normalizeNameSearch(name: string) {
  return name.trim().toLowerCase();
}

export const clientsService = {
  list: async (q: ClientsListQuery) => {
    const where: any = {
      deletedAt: null,
    };

    if (q.status === "active") where.isActive = true;
    if (q.status === "inactive") where.isActive = false;

    if (q.q) {
      const needle = q.q.trim().toLowerCase();
      where.nameSearch = { contains: needle };
    }

    const items = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });

    return items;
  },

  get: async (id: string) => {
    const item = await prisma.client.findFirst({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new AppError("Client introuvable", {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return item;
  },

  create: async (data: ClientCreateInput) => {
    const name = data.name.trim();

    return prisma.client.create({
      data: {
        name,
        nameSearch: normalizeNameSearch(name),

        contactName: data.contactName ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,

        address: data.address ?? null,
        note: data.note ?? null,
        taxId: data.taxId ?? null,

        paymentTermsDays: data.paymentTermsDays ?? null,
        creditLimit: data.creditLimit ?? null,

        isActive: data.isActive ?? true,
        deletedAt: null,
      },
    });
  },

  update: async (id: string, data: ClientUpdateInput) => {
    // check existence (soft delete aware)
    await clientsService.get(id);

    const patch: any = {
      contactName: data.contactName === undefined ? undefined : data.contactName ?? null,
      phone: data.phone === undefined ? undefined : data.phone ?? null,
      email: data.email === undefined ? undefined : data.email ?? null,

      address: data.address === undefined ? undefined : data.address ?? null,
      note: data.note === undefined ? undefined : data.note ?? null,
      taxId: data.taxId === undefined ? undefined : data.taxId ?? null,

      paymentTermsDays:
        data.paymentTermsDays === undefined ? undefined : data.paymentTermsDays ?? null,
      creditLimit: data.creditLimit === undefined ? undefined : data.creditLimit ?? null,
    };

    if (data.name !== undefined) {
      const name = data.name.trim();
      patch.name = name;
      patch.nameSearch = normalizeNameSearch(name);
    }

    return prisma.client.update({
      where: { id },
      data: patch,
    });
  },

  setStatus: async (id: string, isActive: boolean) => {
    // check existence (soft delete aware)
    await clientsService.get(id);

    return prisma.client.update({
      where: { id },
      data: { isActive },
    });
  },

  remove: async (id: string) => {
    // check existence (soft delete aware)
    await clientsService.get(id);

    return prisma.client.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
  },
};