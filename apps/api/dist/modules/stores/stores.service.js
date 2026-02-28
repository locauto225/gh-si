"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storesService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function normalizeCode(code) {
    return code.trim().toUpperCase();
}
function normalizeNameSearch(name) {
    return name.trim().toLowerCase();
}
async function assertStoreExists(id) {
    const item = await prisma_1.prisma.store.findUnique({
        where: { id },
        include: { warehouse: true },
    });
    if (!item) {
        throw new errors_1.AppError("Store not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    }
    return item;
}
exports.storesService = {
    list: async (q) => {
        const where = {
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
        const items = await prisma_1.prisma.store.findMany({
            where,
            orderBy: [{ name: "asc" }],
            take: q.limit,
            include: { warehouse: true },
        });
        return { items };
    },
    listLight: async (q) => {
        const where = {
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
        const items = await prisma_1.prisma.store.findMany({
            where,
            orderBy: [{ name: "asc" }],
            take: q.limit,
            select: { id: true, code: true, name: true, warehouseId: true, isActive: true },
        });
        return { items };
    },
    get: async (id) => {
        const item = await prisma_1.prisma.store.findUnique({
            where: { id },
            include: { warehouse: true },
        });
        if (!item) {
            throw new errors_1.AppError("Store not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        return { item };
    },
    create: async (data) => {
        const code = normalizeCode(data.code);
        const name = data.name.trim();
        // Cohérence soft delete
        const isActive = data.isActive ?? true;
        const item = await prisma_1.prisma.$transaction(async (tx) => {
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
    update: async (id, data) => {
        const existing = await assertStoreExists(id);
        // ✅ Garde-fou: le code d’un store est figé après création.
        // Même si le schema n’accepte plus `code`, on protège le service au cas où.
        if (data.code !== undefined) {
            throw new errors_1.AppError("Store code cannot be changed", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "code" },
            });
        }
        const patch = {};
        if (data.name !== undefined)
            patch.name = data.name.trim();
        if (data.address !== undefined)
            patch.address = data.address?.trim() || null;
        if (data.priceListId !== undefined)
            patch.priceListId = data.priceListId ? String(data.priceListId) : null;
        const item = await prisma_1.prisma.$transaction(async (tx) => {
            // 1) Update Store
            const store = await tx.store.update({
                where: { id },
                data: patch,
                include: { warehouse: true },
            });
            // 2) Mirror => Warehouse suit Store (name/address)
            const whPatch = {};
            if (patch.name !== undefined)
                whPatch.name = patch.name;
            if (patch.address !== undefined)
                whPatch.address = patch.address;
            if (patch.priceListId !== undefined)
                whPatch.priceListId = patch.priceListId;
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
            throw new errors_1.AppError("Store not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        return { item };
    },
    setStatus: async (id, input) => {
        const existing = await assertStoreExists(id);
        const item = await prisma_1.prisma.$transaction(async (tx) => {
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
            throw new errors_1.AppError("Store not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        return { item };
    },
    remove: async (id) => {
        const existing = await assertStoreExists(id);
        const item = await prisma_1.prisma.$transaction(async (tx) => {
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
            throw new errors_1.AppError("Store not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        return { item };
    },
};
