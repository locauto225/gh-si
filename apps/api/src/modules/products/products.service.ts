import { prisma } from "../../db/prisma";
import type { ProductCreateInput, ProductUpdateInput } from "./products.schemas";

type ListStatus = "active" | "inactive" | "all";

function toNameSearch(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    // remove accents/diacritics
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // collapse whitespace
    .replace(/\s+/g, " ");
}

export const productsService = {
  // Par défaut: on ne renvoie que les produits actifs.
  // Tu peux appeler list({ status: "all" }) ou list({ status: "inactive" }) plus tard.
  list: async (opts?: { status?: ListStatus; q?: string; categoryId?: string; limit?: number }) => {
    const status = opts?.status ?? "active";

    const where: any =
      status === "all"
        ? {}
        : status === "inactive"
          ? { isActive: false }
          : { isActive: true };

    // Filtre par catégorie
    if (opts?.categoryId) where.categoryId = String(opts.categoryId);

    // Recherche (SKU + nameSearch)
    const qRaw = String(opts?.q ?? "").trim();
    if (qRaw) {
      const qNorm = toNameSearch(qRaw);
      where.OR = [
        { sku: { contains: qRaw, mode: "insensitive" } },
        { sku: { startsWith: qRaw, mode: "insensitive" } },
        { nameSearch: { contains: qNorm } },
        { nameSearch: { startsWith: qNorm } },
      ];
    }

    // Limite pour éviter de renvoyer trop d'items
    const take = Math.min(Math.max(Number(opts?.limit ?? 50) || 50, 1), 500);

    return prisma.product.findMany({
      where,
      take,
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  },

  get: async (id: string) => {
    return prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
  },

  create: async (data: ProductCreateInput) => {
    return prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        nameSearch: toNameSearch(data.name),
        unit: data.unit ?? "bouteille",
        price: data.price ?? 0,
        isActive: data.isActive ?? true,
        deletedAt: data.isActive === false ? new Date() : null,

        // Boissons
        brand: data.brand ?? null,
        barcode: data.barcode ?? null,
        packSize: data.packSize ?? null,

        // Catégorie (V1: optionnelle)
        categoryId: data.categoryId ?? null,
      },
      include: { category: true },
    });
  },

  update: async (id: string, data: ProductUpdateInput) => {
    const nextIsActive = data.isActive;

    return prisma.product.update({
      where: { id },
      data: {
        ...data,

        // 🔎 index de recherche (mis à jour uniquement si name est fourni)
        nameSearch: data.name === undefined ? undefined : toNameSearch(data.name),

        // Normaliser optionnels : si le champ est fourni vide/null -> on met null ; si absent -> on ne touche pas
        brand: data.brand === undefined ? undefined : data.brand ?? null,
        barcode: data.barcode === undefined ? undefined : data.barcode ?? null,
        packSize: data.packSize === undefined ? undefined : data.packSize ?? null,
        categoryId: data.categoryId === undefined ? undefined : data.categoryId ?? null,

        // Si on change le statut via update, on aligne deletedAt
        deletedAt:
          nextIsActive === undefined
            ? undefined
            : nextIsActive
              ? null
              : new Date(),
      },
      include: { category: true },
    });
  },

  // ✅ Nouvelle méthode dédiée (plus claire pour la route PATCH /products/:id/status)
  setStatus: async (id: string, isActive: boolean) => {
    return prisma.product.update({
      where: { id },
      data: {
        isActive,
        deletedAt: isActive ? null : new Date(),
      },
      include: { category: true },
    });
  },

  // ⚠️ V1: on évite le delete physique. On désactive (soft delete).
  remove: async (id: string) => {
    return prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      include: { category: true },
    });
  },
};