import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type { StoreCreateInput, StoresListQuery, StoreSetStatusInput, StoreUpdateInput } from "./stores.schemas";

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizeNameSearch(name: string) {
  return name.trim().toLowerCase();
}

async function assertStoreExists(id: string) {
  const item = await prisma.store.findUnique({
    where: { id },
    include: { warehouse: true },
  });
  if (!item) {
    throw new AppError("Store not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }
  return item;
}

export const storesService = {
  list: async (q: StoresListQuery) => {
    const where: any = {
      deletedAt: null,
      ...(q.status === "active" ? { isActive: true } : {}),
      ...(q.status === "inactive" ? { isActive: false } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q } },
              { code: { contains: q.q.toUpperCase() } },
            ],
          }
        : {}),
    };

    const items = await prisma.store.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: q.limit,
      include: { warehouse: true },
    });

    return { items };
  },

  listLight: async (q: { q?: string; limit: number; status: "active" | "inactive" | "all" }) => {
    const where: any = {
      deletedAt: null,
      ...(q.status === "active" ? { isActive: true } : {}),
      ...(q.status === "inactive" ? { isActive: false } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q } },
              { code: { contains: q.q.toUpperCase() } },
            ],
          }
        : {}),
    };

    const items = await prisma.store.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: q.limit,
      select: { id: true, code: true, name: true, warehouseId: true, isActive: true },
    });

    return { items };
  },

  get: async (id: string) => {
    const item = await prisma.store.findUnique({
      where: { id },
      include: { warehouse: true },
    });
    if (!item) {
      throw new AppError("Store not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }
    return { item };
  },

  create: async (data: StoreCreateInput) => {
    const code = normalizeCode(data.code);
    const name = data.name.trim();

    // Cohérence soft delete
    const isActive = data.isActive ?? true;

    const item = await prisma.$transaction(async (tx) => {
      // 1) Créer un Warehouse dédié au store
      const warehouse = await tx.warehouse.create({
        data: {
          // On évite les collisions avec les entrepôts DEPOT en préfixant
          code: `MAG-${code}`,
          name,
          address: data.address?.trim() || null,
          kind: "STORE",
          isActive,
          deletedAt: isActive ? null : new Date(),
        },
      });

      // 2) Créer le Store lié à ce Warehouse
      const store = await tx.store.create({
        data: {
          code,
          name,
          address: data.address?.trim() || null,
          warehouseId: warehouse.id,
          isActive,
          deletedAt: isActive ? null : new Date(),
        },
        include: { warehouse: true },
      });

      return store;
    });

    return { item };
  },

  update: async (id: string, data: StoreUpdateInput) => {
    const existing = await assertStoreExists(id);

    // ✅ Garde-fou: le code d’un store est figé après création.
    // Même si le schema n’accepte plus `code`, on protège le service au cas où.
    if ((data as any).code !== undefined) {
      throw new AppError("Store code cannot be changed", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { field: "code" },
      });
    }

    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.address !== undefined) patch.address = data.address?.trim() || null;
    if (data.priceListId !== undefined)
      patch.priceListId = data.priceListId ? String(data.priceListId) : null;

    const item = await prisma.$transaction(async (tx) => {
      // 1) Update Store
      const store = await tx.store.update({
        where: { id },
        data: patch,
        include: { warehouse: true },
      });

      // 2) Mirror => Warehouse suit Store (name/address)
      const whPatch: any = {};
      if (patch.name !== undefined) whPatch.name = patch.name;
      if (patch.address !== undefined) whPatch.address = patch.address;
      if (patch.priceListId !== undefined) whPatch.priceListId = patch.priceListId;

      if (Object.keys(whPatch).length > 0) {
        await tx.warehouse.update({
          where: { id: existing.warehouseId },
          data: whPatch,
        });
      }

      // Re-read with warehouse (so we return the mirrored values)
      return tx.store.findUnique({
        where: { id },
        include: { warehouse: true },
      });
    });

    if (!item) {
      throw new AppError("Store not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    return { item };
  },

  setStatus: async (id: string, input: StoreSetStatusInput) => {
    const existing = await assertStoreExists(id);

    const item = await prisma.$transaction(async (tx) => {
      const deletedAt = input.isActive ? null : new Date();

      // 1) Store
      await tx.store.update({
        where: { id },
        data: {
          isActive: input.isActive,
          deletedAt,
        },
      });

      // 2) Mirror => Warehouse suit Store (status)
      await tx.warehouse.update({
        where: { id: existing.warehouseId },
        data: {
          isActive: input.isActive,
          deletedAt,
        },
      });

      return tx.store.findUnique({
        where: { id },
        include: { warehouse: true },
      });
    });

    if (!item) {
      throw new AppError("Store not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    return { item };
  },

  remove: async (id: string) => {
    const existing = await assertStoreExists(id);

    const item = await prisma.$transaction(async (tx) => {
      const deletedAt = new Date();

      // 1) Store
      await tx.store.update({
        where: { id },
        data: { isActive: false, deletedAt },
      });

      // 2) Mirror => Warehouse suit Store (status)
      await tx.warehouse.update({
        where: { id: existing.warehouseId },
        data: { isActive: false, deletedAt },
      });

      return tx.store.findUnique({
        where: { id },
        include: { warehouse: true },
      });
    });

    if (!item) {
      throw new AppError("Store not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    return { item };
  },
};