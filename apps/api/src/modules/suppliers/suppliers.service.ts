import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type {
  SupplierCreateInput,
  SupplierUpdateInput,
  SuppliersListQuery,
  SupplierStatusInput,
} from "./suppliers.schemas";

function normalizeStr(v: unknown): string | null {
  if (v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export const suppliersService = {
  list: async (q: SuppliersListQuery) => {
    const whereBase = { deletedAt: null };

    const whereStatus =
      q.status === "all"
        ? {}
        : q.status === "active"
          ? { isActive: true }
          : { isActive: false };

    return prisma.supplier.findMany({
      where: {
        ...whereBase,
        ...whereStatus,
        ...(q.q
          ? {
              nameSearch: { contains: q.q.trim().toLowerCase() },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
  },

  get: async (id: string) => {
    const item = await prisma.supplier.findUnique({ where: { id } });
    if (!item || item.deletedAt) {
      throw new AppError("Fournisseur introuvable", {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        details: { id },
      });
    }
    return item;
  },

  create: async (data: SupplierCreateInput) => {
    // Normalisation optionnels -> null si vide
    const name = data.name.trim();
    const nameSearch = name.toLowerCase();
    const phone = normalizeStr(data.phone);
    const email = normalizeStr(data.email);
    const contactName = normalizeStr(data.contactName);
    const address = normalizeStr(data.address);
    const note = normalizeStr(data.note);
    const taxId = normalizeStr(data.taxId);

    return prisma.supplier.create({
      data: {
        name,
        nameSearch,
        phone,
        email,

        contactName,
        address,
        note,
        taxId,
        paymentTermsDays: data.paymentTermsDays ?? null,
        creditLimit: data.creditLimit ?? null,

        isActive: true,
        deletedAt: null,
      },
    });
  },

  update: async (id: string, data: SupplierUpdateInput) => {
    await suppliersService.get(id); // vérifie existe + pas deleted

    const patch: any = { ...data };

    if (data.name !== undefined) {
      const name = data.name.trim();
      patch.name = name;
      patch.nameSearch = name.toLowerCase();
    }

    if (data.phone !== undefined) patch.phone = normalizeStr(data.phone);
    if (data.email !== undefined) patch.email = normalizeStr(data.email);
    if (data.contactName !== undefined) patch.contactName = normalizeStr(data.contactName);
    if (data.address !== undefined) patch.address = normalizeStr(data.address);
    if (data.note !== undefined) patch.note = normalizeStr(data.note);
    if (data.taxId !== undefined) patch.taxId = normalizeStr(data.taxId);

    return prisma.supplier.update({
      where: { id },
      data: patch,
    });
  },

  setStatus: async (id: string, data: SupplierStatusInput) => {
    await suppliersService.get(id);

    return prisma.supplier.update({
      where: { id },
      data: {
        isActive: data.isActive,
        deletedAt: null,
      },
    });
  },

  remove: async (id: string) => {
    await suppliersService.get(id);

    // soft delete
    return prisma.supplier.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  },
};