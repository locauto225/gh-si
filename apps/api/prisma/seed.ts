// apps/api/prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed idempotent "pro" :
 * - Upsert 2 grilles: TARIF_DEPOT + TARIF_MAGASIN
 * - Assigne priceListId par défaut aux Warehouses/Stores si null
 * - (Optionnel) remplit les items manquants (unitPrice = Product.price)
 *
 * Pour activer le remplissage items:
 *   SEED_FILL_PRICES=1 npm run prisma:seed
 */
async function main() {
  const FILL_PRICES = process.env.SEED_FILL_PRICES === "1";

  // 1) Upsert des 2 grilles de base
  const depot = await prisma.priceList.upsert({
    where: { code: "TARIF_DEPOT" },
    update: {
      name: "Tarif Dépôt",
      note: "Grille par défaut pour ventes dépôt (wholesale).",
      isActive: true,
      deletedAt: null,
    },
    create: {
      code: "TARIF_DEPOT",
      name: "Tarif Dépôt",
      note: "Grille par défaut pour ventes dépôt (wholesale).",
      isActive: true,
    },
  });

  const magasin = await prisma.priceList.upsert({
    where: { code: "TARIF_MAGASIN" },
    update: {
      name: "Tarif Magasin",
      note: "Grille par défaut pour ventes magasin (retail).",
      isActive: true,
      deletedAt: null,
    },
    create: {
      code: "TARIF_MAGASIN",
      name: "Tarif Magasin",
      note: "Grille par défaut pour ventes magasin (retail).",
      isActive: true,
    },
  });

  // 1.b) Entrepôt technique TRANSIT (pour workflow expédition/réception)
  // - Kind DEPOT (entrepôt)
  // - PriceListId: depot (par défaut)
  await prisma.warehouse.upsert({
    where: { code: "TRANSIT" },
    update: {
      name: "Transit (Livraisons)",
      address: null,
      kind: "DEPOT",
      isSystem: true,
      isActive: true,
      deletedAt: null,
      priceListId: depot.id,
    },
    create: {
      code: "TRANSIT",
      name: "Transit (Livraisons)",
      address: null,
      kind: "DEPOT",
      isSystem: true,
      isActive: true,
      priceListId: depot.id,
    },
  });

  // 2) Assigner par défaut (uniquement si priceListId est NULL)
  // Warehouses DEPOT -> depot
  await prisma.warehouse.updateMany({
    where: { priceListId: null, kind: "DEPOT" },
    data: { priceListId: depot.id },
  });

  // Warehouses STORE -> magasin (safe, même si STORE utilise surtout Store.priceListId)
  await prisma.warehouse.updateMany({
    where: { priceListId: null, kind: "STORE" },
    data: { priceListId: magasin.id },
  });

  // Stores -> magasin
  await prisma.store.updateMany({
    where: { priceListId: null },
    data: { priceListId: magasin.id },
  });

  // 3) Optionnel: créer les PriceListItem manquants
  if (FILL_PRICES) {
    const products = await prisma.product.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, price: true },
    });

    // Mapping simple V1: unitPrice = Product.price (FCFA)
    const depotItems = products.map((p) => ({
      priceListId: depot.id,
      productId: p.id,
      unitPrice: Math.max(0, p.price ?? 0),
    }));

    const magasinItems = products.map((p) => ({
      priceListId: magasin.id,
      productId: p.id,
      unitPrice: Math.max(0, p.price ?? 0),
    }));

    const [existingDepot, existingMagasin] = await Promise.all([
      prisma.priceListItem.findMany({
        where: { priceListId: depot.id },
        select: { productId: true },
      }),
      prisma.priceListItem.findMany({
        where: { priceListId: magasin.id },
        select: { productId: true },
      }),
    ]);

    const depotSet = new Set(existingDepot.map((x) => x.productId));
    const magasinSet = new Set(existingMagasin.map((x) => x.productId));

    const depotMissing = depotItems.filter((it) => !depotSet.has(it.productId));
    const magasinMissing = magasinItems.filter((it) => !magasinSet.has(it.productId));

    if (depotMissing.length > 0) {
      await prisma.priceListItem.createMany({ data: depotMissing });
    }

    if (magasinMissing.length > 0) {
      await prisma.priceListItem.createMany({ data: magasinMissing });
    }
  }

  // Petit log utile
  const [warehouses, stores] = await Promise.all([
    prisma.warehouse.count(),
    prisma.store.count(),
  ]);

  console.log("[seed] OK", {
    priceLists: { depot: depot.id, magasin: magasin.id },
    transitWarehouseCode: "TRANSIT",
    fillPrices: FILL_PRICES,
    warehouses,
    stores,
  });
}

main()
  .catch((e) => {
    console.error("[seed] FAILED", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });