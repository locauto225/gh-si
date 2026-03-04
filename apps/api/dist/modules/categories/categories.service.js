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
async function uniqueSlugForCategory(base) {
    const existing = await prisma_1.prisma.category.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
    });
    const used = new Set(existing.map((e) => e.slug));
    if (!used.has(base))
        return base;
    let i = 2;
    while (used.has(`${base}-${i}`))
        i++;
    return `${base}-${i}`;
}
async function uniqueSlugForSubCategory(base) {
    const existing = await prisma_1.prisma.subCategory.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
    });
    const used = new Set(existing.map((e) => e.slug));
    if (!used.has(base))
        return base;
    let i = 2;
    while (used.has(`${base}-${i}`))
        i++;
    return `${base}-${i}`;
}
exports.categoriesService = {
    list: async (options) => {
        const includeSubcategories = Boolean(options?.includeSubcategories);
        return prisma_1.prisma.category.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            ...(includeSubcategories
                ? {
                    include: {
                        subcategories: {
                            where: { isActive: true },
                            orderBy: { name: "asc" },
                        },
                    },
                }
                : {}),
        });
    },
    listSubcategories: async (categoryId) => {
        return prisma_1.prisma.subCategory.findMany({
            where: { categoryId, isActive: true },
            orderBy: { name: "asc" },
        });
    },
    create: async (data) => {
        const base = slugify(data.name);
        const slug = await uniqueSlugForCategory(base);
        return prisma_1.prisma.category.create({
            data: { name: data.name.trim(), slug, isActive: true },
        });
    },
    createSubcategory: async (data) => {
        const base = slugify(data.name);
        const slug = await uniqueSlugForSubCategory(base);
        return prisma_1.prisma.subCategory.create({
            data: { name: data.name.trim(), slug, categoryId: data.categoryId },
        });
    },
};
