"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDrivers = listDrivers;
exports.createDriver = createDriver;
exports.getDriverById = getDriverById;
exports.updateDriver = updateDriver;
// ⚠️ Adapte cet import à ton projet
// ex: import { prisma } from "@/lib/prisma";
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function listDrivers(q) {
    const where = {
        deletedAt: null,
    };
    if (q.status === "active")
        where.isActive = true;
    if (q.status === "inactive")
        where.isActive = false;
    if (q.q && q.q.length > 0) {
        // simple search: name OR phone OR email
        where.OR = [
            { name: { contains: q.q, mode: "insensitive" } },
            { phone: { contains: q.q } },
            { email: { contains: q.q, mode: "insensitive" } },
        ];
    }
    const items = await prisma.driver.findMany({
        where,
        orderBy: { name: "asc" },
        take: q.limit,
    });
    return { items };
}
async function createDriver(data) {
    const created = await prisma.driver.create({
        data: {
            name: data.name,
            phone: data.phone ?? null,
            email: data.email ?? null,
            isActive: data.isActive ?? true,
        },
    });
    return created;
}
async function getDriverById(id) {
    const driver = await prisma.driver.findFirst({
        where: { id, deletedAt: null },
    });
    return driver;
}
async function updateDriver(id, data) {
    const updated = await prisma.driver.update({
        where: { id },
        data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.email !== undefined ? { email: data.email } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
    });
    return updated;
}
