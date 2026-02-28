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
  list: async () => {
    return prisma.category.findMany({
      where: { isActive: true },
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