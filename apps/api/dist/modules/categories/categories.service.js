"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesService = void 0;
const prisma_1 = require("../../db/prisma");
function slugify(input) {
    return input
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}
exports.categoriesService = {
    list: async () => {
        return prisma_1.prisma.category.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
    },
    create: async (data) => {
        const slug = slugify(data.name);
        return prisma_1.prisma.category.create({
            data: { name: data.name.trim(), slug, isActive: true },
        });
    },
};
