import { prisma } from "../../db/prisma";
import type { CategoryCreateInput, SubCategoryCreateInput } from "./categories.schemas";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function uniqueSlugForCategory(base: string) {
  const existing = await prisma.category.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  const used = new Set(existing.map((e) => e.slug));
  if (!used.has(base)) return base;

  let i = 2;
  while (used.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

async function uniqueSlugForSubCategory(base: string) {
  const existing = await prisma.subCategory.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  const used = new Set(existing.map((e) => e.slug));
  if (!used.has(base)) return base;

  let i = 2;
  while (used.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export const categoriesService = {
  list: async (options?: { includeSubcategories?: boolean }) => {
    const includeSubcategories = Boolean(options?.includeSubcategories);

    return prisma.category.findMany({
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

  listSubcategories: async (categoryId: string) => {
    return prisma.subCategory.findMany({
      where: { categoryId, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  create: async (data: CategoryCreateInput) => {
    const base = slugify(data.name);
    const slug = await uniqueSlugForCategory(base);
    return prisma.category.create({
      data: { name: data.name.trim(), slug, isActive: true },
    });
  },

  createSubcategory: async (data: SubCategoryCreateInput) => {
    const base = slugify(data.name);
    const slug = await uniqueSlugForSubCategory(base);
    return prisma.subCategory.create({
      data: { name: data.name.trim(), slug, categoryId: data.categoryId },
    });
  },
};