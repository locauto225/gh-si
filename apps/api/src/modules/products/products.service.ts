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

    const rows = await prisma.product.findMany({
      where,
      take,
      select: {
        id: true,
        sku: true,
        name: true,
        nameSearch: true,
        unit: true,
        price: true,
        isActive: true,
        deletedAt: true,
        purchasePrice: true,
        weightGr: true,
        volumeMl: true,
        brand: true,
        imageUrl: true,
        barcode: true,
        packSize: true,
        description: true,
        taxCode: true,
        taxRate: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        suppliers: {
          select: {
            lastUnitPrice: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => {
      const supplierPrices = row.suppliers
        .map((s) => Number(s.lastUnitPrice))
        .filter((v) => Number.isFinite(v) && v > 0)
        .map((v) => Math.trunc(v));

      const bestSupplierUnitPrice = supplierPrices.length > 0 ? Math.min(...supplierPrices) : null;
      const visibleCategory = row.category && row.category.deletedAt === null ? row.category : null;

      return {
        ...row,
        categoryId: visibleCategory ? row.categoryId : null,
        category: visibleCategory,
        bestSupplierUnitPrice,
      };
    });
  },

  get: async (id: string) => {
    const item = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        barcodes: true,
        packagings: true,
        subCategories: {
          where: {
            subCategory: {
              deletedAt: null,
            },
          },
          include: { subCategory: true },
        },
        suppliers: { include: { supplier: true, packaging: true } },
        purchasePrices: { orderBy: { effectiveAt: "desc" }, take: 20 },
      },
    });

    if (!item) return null;

    const visibleCategory = item.category && item.category.deletedAt === null ? item.category : null;

    return {
      ...item,
      categoryId: visibleCategory ? item.categoryId : null,
      category: visibleCategory,
    };
  },

  create: async (data: ProductCreateInput) => {
    const purchasePrice = data.purchasePrice ?? 0;

    return prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        nameSearch: toNameSearch(data.name),
        unit: data.unit ?? "bouteille",
        price: data.price ?? 0,
        isActive: data.isActive ?? true,
        deletedAt: data.isActive === false ? new Date() : null,

        // ✅ Achat
        purchasePrice,

        // ✅ Logistique / e-commerce
        weightGr: data.weightGr ?? null,
        volumeMl: data.volumeMl ?? null,

        // ✅ Boissons (optionnels)
        brand: data.brand ?? null,

        // ✅ Photo produit (optionnelle) — URL (CDN / Cloudinary)
        imageUrl: data.imageUrl ?? null,

        // ✅ Catégorie
        categoryId: data.categoryId ?? null,

        // ✅ Relations
        barcodes: data.barcodes?.length
          ? { create: data.barcodes.map((b) => ({ code: b.code, label: b.label ?? null })) }
          : undefined,

        packagings: data.packagings?.length
          ? {
              create: data.packagings.map((p) => ({
                name: p.name,
                units: p.units,
                barcode: p.barcode ?? null,
                grossWeightGr: p.grossWeightGr ?? null,
                tareWeightGr: p.tareWeightGr ?? null,
              })),
            }
          : undefined,

        subCategories: data.subCategoryIds?.length
          ? { create: data.subCategoryIds.map((subCategoryId) => ({ subCategoryId })) }
          : undefined,

        suppliers: data.suppliers?.length
          ? {
              create: data.suppliers.map((s) => ({
                supplierId: s.supplierId,
                supplierSku: s.supplierSku ?? null,
                packagingId: s.packagingId ?? null,
                lastUnitPrice: s.lastUnitPrice ?? null,
              })),
            }
          : undefined,

        // ✅ Historique prix d'achat (on écrit une ligne si un prix est fourni)
        purchasePrices: purchasePrice > 0 ? { create: [{ unitPrice: purchasePrice, effectiveAt: new Date() }] } : undefined,
      },
      include: {
        category: true,
        barcodes: true,
        packagings: true,
        subCategories: { include: { subCategory: true } },
        suppliers: { include: { supplier: true, packaging: true } },
        purchasePrices: { orderBy: { effectiveAt: "desc" }, take: 20 },
      },
    });
  },

  update: async (id: string, data: ProductUpdateInput) => {
    const nextIsActive = data.isActive;

    // ✅ scalaires (sans spread pour éviter d'injecter des arrays)
    const scalarData: any = {
      name: data.name === undefined ? undefined : data.name,
      nameSearch: data.name === undefined ? undefined : toNameSearch(data.name),
      unit: data.unit === undefined ? undefined : data.unit,
      price: data.price === undefined ? undefined : data.price,
      isActive: data.isActive === undefined ? undefined : data.isActive,

      purchasePrice: data.purchasePrice === undefined ? undefined : data.purchasePrice,
      weightGr: data.weightGr === undefined ? undefined : data.weightGr ?? null,
      volumeMl: data.volumeMl === undefined ? undefined : data.volumeMl ?? null,

      brand: data.brand === undefined ? undefined : data.brand ?? null,

      imageUrl: data.imageUrl === undefined ? undefined : data.imageUrl ?? null,

      categoryId: data.categoryId === undefined ? undefined : data.categoryId ?? null,

      // Si on change le statut via update, on aligne deletedAt
      deletedAt:
        nextIsActive === undefined
          ? undefined
          : nextIsActive
            ? null
            : new Date(),
    };

    // ✅ relations : si le champ est présent dans le payload, on remplace entièrement (deleteMany + create)
    const relData: any = {};

    if (data.barcodes !== undefined) {
      relData.barcodes = {
        deleteMany: {},
        create: (data.barcodes ?? []).map((b) => ({ code: b.code, label: b.label ?? null })),
      };
    }

    if (data.packagings !== undefined) {
      relData.packagings = {
        deleteMany: {},
        create: (data.packagings ?? []).map((p) => ({
          name: p.name,
          units: p.units,
          barcode: p.barcode ?? null,
          grossWeightGr: p.grossWeightGr ?? null,
          tareWeightGr: p.tareWeightGr ?? null,
        })),
      };
    }

    if (data.subCategoryIds !== undefined) {
      relData.subCategories = {
        deleteMany: {},
        create: (data.subCategoryIds ?? []).map((subCategoryId) => ({ subCategoryId })),
      };
    }

    if (data.suppliers !== undefined) {
      relData.suppliers = {
        deleteMany: {},
        create: (data.suppliers ?? []).map((s) => ({
          supplierId: s.supplierId,
          supplierSku: s.supplierSku ?? null,
          packagingId: s.packagingId ?? null,
          lastUnitPrice: s.lastUnitPrice ?? null,
        })),
      };
    }

    // ✅ Historique prix d'achat : si purchasePrice est fourni et > 0, on ajoute une ligne d'historique
    if (data.purchasePrice !== undefined && (data.purchasePrice ?? 0) > 0) {
      relData.purchasePrices = {
        create: [{ unitPrice: data.purchasePrice ?? 0, effectiveAt: new Date() }],
      };
    }

    return prisma.product.update({
      where: { id },
      data: {
        ...scalarData,
        ...relData,
      },
      include: {
        category: true,
        barcodes: true,
        packagings: true,
        subCategories: { include: { subCategory: true } },
        suppliers: { include: { supplier: true, packaging: true } },
        purchasePrices: { orderBy: { effectiveAt: "desc" }, take: 20 },
      },
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
