import { prisma } from "../../db/prisma";
import type {
  WarehouseCreateInput,
  WarehousesListQuery,
  WarehouseUpdateInput,
} from "./warehouses.schemas";


export const warehousesService = {
  // Par défaut: uniquement actifs + DEPOT
  list: async (q: WarehousesListQuery) => {
    const status = q.status ?? "active";
    const kind = q.kind ?? "DEPOT";

    const baseWhere =
      status === "all"
        ? {}
        : status === "inactive"
          ? {
              OR: [{ isActive: false }, { deletedAt: { not: null } }],
            }
          : {
              isActive: true,
              deletedAt: null,
            };

    const where: any = {
      ...baseWhere,
      ...(kind === "all" ? {} : { kind }),
      ...(q.q
        ? {
            OR: [
              { code: { contains: q.q } },
              { name: { contains: q.q } },
            ],
          }
        : {}),
    };

    return prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
  },

  get: async (id: string) => {
    return prisma.warehouse.findUnique({ where: { id } });
  },

  create: async (data: WarehouseCreateInput) => {
    return prisma.warehouse.create({
      data: {
        code: data.code,
        name: data.name,
        address: data.address ?? null,
        isActive: data.isActive ?? true,
        deletedAt: data.isActive === false ? new Date() : null,
      },
    });
  },

  update: async (id: string, data: WarehouseUpdateInput) => {
    return prisma.warehouse.update({
      where: { id },
      data: {
        ...data,
        address: data.address === undefined ? undefined : data.address ?? null,
      },
    });
  },

  setStatus: async (id: string, isActive: boolean) => {
    return prisma.warehouse.update({
      where: { id },
      data: {
        isActive,
        deletedAt: isActive ? null : new Date(),
      },
    });
  },

  // V1: pas de delete physique
  remove: async (id: string) => {
    return prisma.warehouse.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  },
};