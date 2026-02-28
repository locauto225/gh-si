"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warehousesService = void 0;
const prisma_1 = require("../../db/prisma");
exports.warehousesService = {
    // Par défaut: uniquement actifs + DEPOT
    list: async (q) => {
        const status = q.status ?? "active";
        const kind = q.kind ?? "DEPOT";
        const baseWhere = status === "all"
            ? {}
            : status === "inactive"
                ? {
                    OR: [{ isActive: false }, { deletedAt: { not: null } }],
                }
                : {
                    isActive: true,
                    deletedAt: null,
                };
        const where = {
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
        return prisma_1.prisma.warehouse.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: q.limit,
        });
    },
    get: async (id) => {
        return prisma_1.prisma.warehouse.findUnique({ where: { id } });
    },
    create: async (data) => {
        return prisma_1.prisma.warehouse.create({
            data: {
                code: data.code,
                name: data.name,
                address: data.address ?? null,
                isActive: data.isActive ?? true,
                deletedAt: data.isActive === false ? new Date() : null,
            },
        });
    },
    update: async (id, data) => {
        return prisma_1.prisma.warehouse.update({
            where: { id },
            data: {
                ...data,
                address: data.address === undefined ? undefined : data.address ?? null,
            },
        });
    },
    setStatus: async (id, isActive) => {
        return prisma_1.prisma.warehouse.update({
            where: { id },
            data: {
                isActive,
                deletedAt: isActive ? null : new Date(),
            },
        });
    },
    // V1: pas de delete physique
    remove: async (id) => {
        return prisma_1.prisma.warehouse.update({
            where: { id },
            data: {
                isActive: false,
                deletedAt: new Date(),
            },
        });
    },
};
