"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientsService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function normalizeNameSearch(name) {
    return name.trim().toLowerCase();
}
exports.clientsService = {
    list: async (q) => {
        const where = {
            deletedAt: null,
        };
        if (q.status === "active")
            where.isActive = true;
        if (q.status === "inactive")
            where.isActive = false;
        if (q.q) {
            const needle = q.q.trim().toLowerCase();
            where.nameSearch = { contains: needle };
        }
        const items = await prisma_1.prisma.client.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: q.limit,
        });
        return items;
    },
    get: async (id) => {
        const item = await prisma_1.prisma.client.findFirst({
            where: { id, deletedAt: null },
        });
        if (!item) {
            throw new errors_1.AppError("Client introuvable", {
                status: 404,
                code: errors_1.ERROR_CODES.NOT_FOUND,
            });
        }
        return item;
    },
    create: async (data) => {
        const name = data.name.trim();
        return prisma_1.prisma.client.create({
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
    update: async (id, data) => {
        // check existence (soft delete aware)
        await exports.clientsService.get(id);
        const patch = {
            contactName: data.contactName === undefined ? undefined : data.contactName ?? null,
            phone: data.phone === undefined ? undefined : data.phone ?? null,
            email: data.email === undefined ? undefined : data.email ?? null,
            address: data.address === undefined ? undefined : data.address ?? null,
            note: data.note === undefined ? undefined : data.note ?? null,
            taxId: data.taxId === undefined ? undefined : data.taxId ?? null,
            paymentTermsDays: data.paymentTermsDays === undefined ? undefined : data.paymentTermsDays ?? null,
            creditLimit: data.creditLimit === undefined ? undefined : data.creditLimit ?? null,
        };
        if (data.name !== undefined) {
            const name = data.name.trim();
            patch.name = name;
            patch.nameSearch = normalizeNameSearch(name);
        }
        return prisma_1.prisma.client.update({
            where: { id },
            data: patch,
        });
    },
    setStatus: async (id, isActive) => {
        // check existence (soft delete aware)
        await exports.clientsService.get(id);
        return prisma_1.prisma.client.update({
            where: { id },
            data: { isActive },
        });
    },
    remove: async (id) => {
        // check existence (soft delete aware)
        await exports.clientsService.get(id);
        return prisma_1.prisma.client.update({
            where: { id },
            data: { isActive: false, deletedAt: new Date() },
        });
    },
};
