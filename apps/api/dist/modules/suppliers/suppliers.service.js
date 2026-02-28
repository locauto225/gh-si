"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suppliersService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function normalizeStr(v) {
    if (v === undefined)
        return null;
    const s = String(v).trim();
    return s.length ? s : null;
}
exports.suppliersService = {
    list: async (q) => {
        const whereBase = { deletedAt: null };
        const whereStatus = q.status === "all"
            ? {}
            : q.status === "active"
                ? { isActive: true }
                : { isActive: false };
        return prisma_1.prisma.supplier.findMany({
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
    get: async (id) => {
        const item = await prisma_1.prisma.supplier.findUnique({ where: { id } });
        if (!item || item.deletedAt) {
            throw new errors_1.AppError("Fournisseur introuvable", {
                status: 404,
                code: errors_1.ERROR_CODES.NOT_FOUND,
                details: { id },
            });
        }
        return item;
    },
    create: async (data) => {
        // Normalisation optionnels -> null si vide
        const name = data.name.trim();
        const nameSearch = name.toLowerCase();
        const phone = normalizeStr(data.phone);
        const email = normalizeStr(data.email);
        const contactName = normalizeStr(data.contactName);
        const address = normalizeStr(data.address);
        const note = normalizeStr(data.note);
        const taxId = normalizeStr(data.taxId);
        return prisma_1.prisma.supplier.create({
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
    update: async (id, data) => {
        await exports.suppliersService.get(id); // vérifie existe + pas deleted
        const patch = { ...data };
        if (data.name !== undefined) {
            const name = data.name.trim();
            patch.name = name;
            patch.nameSearch = name.toLowerCase();
        }
        if (data.phone !== undefined)
            patch.phone = normalizeStr(data.phone);
        if (data.email !== undefined)
            patch.email = normalizeStr(data.email);
        if (data.contactName !== undefined)
            patch.contactName = normalizeStr(data.contactName);
        if (data.address !== undefined)
            patch.address = normalizeStr(data.address);
        if (data.note !== undefined)
            patch.note = normalizeStr(data.note);
        if (data.taxId !== undefined)
            patch.taxId = normalizeStr(data.taxId);
        return prisma_1.prisma.supplier.update({
            where: { id },
            data: patch,
        });
    },
    setStatus: async (id, data) => {
        await exports.suppliersService.get(id);
        return prisma_1.prisma.supplier.update({
            where: { id },
            data: {
                isActive: data.isActive,
                deletedAt: null,
            },
        });
    },
    remove: async (id) => {
        await exports.suppliersService.get(id);
        // soft delete
        return prisma_1.prisma.supplier.update({
            where: { id },
            data: {
                isActive: false,
                deletedAt: new Date(),
            },
        });
    },
};
