import { prisma } from "../../db/prisma";
import type { CategoryCreateInput } from "./categories.schemas";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export const categoriesService = {
  list: async (options?: { includeSubcategories?: boolean }) => {
    const includeSubcategories = Boolean(options?.includeSubcategories);

    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      ...(includeSubcategories ? { include: { subcategories: true } } : {}),
    });
  },

  listSubcategories: async (categoryId: string) => {
    return prisma.subCategory.findMany({
      where: { categoryId },
      orderBy: { name: "asc" },
    });
  },

  create: async (data: CategoryCreateInput) => {
    const slug = slugify(data.name);
    return prisma.category.create({
      data: { name: data.name.trim(), slug, isActive: true },
    });
  },
};