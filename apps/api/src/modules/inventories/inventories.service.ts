import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";

function makeInventoryNumber() {
  // Simple + robuste (unique) sans compteur: INVSTK-YYYYMMDD-xxxxx
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INVSTK-${y}${m}${day}-${rand}`;
}

const inventoryListInclude: any = {
  warehouse: true,
  category: true,
  _count: { select: { lines: true } },
};

const inventoryGetInclude: any = {
  warehouse: true,
  category: true,
  lines: {
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { product: { include: { category: true } } },
  },
};

const inventoryPostInclude: any = {
  warehouse: { select: { id: true, kind: true } },
  lines: { include: { product: { select: { id: true } } } },
};


export const inventoriesService = {
  list: async (q: { warehouseId?: string; status?: "DRAFT" | "POSTED" | "CANCELLED"; limit?: number }) => {
    const where: any = {};
    if (q.warehouseId) where.warehouseId = q.warehouseId;
    if (q.status) where.status = q.status;

    const items = await prisma.stockInventory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit ?? 50,
      include: inventoryListInclude,
    });

    return items;
  },

  get: async (id: string) => {
    const item = await prisma.stockInventory.findUnique({
      where: { id },
      include: inventoryGetInclude,
    });

    return item;
  },

  createDraft: async (data: { warehouseId: string; mode?: "FULL" | "CATEGORY" | "FREE"; categoryId?: string | null; note?: string | null }) => {
    return prisma.$transaction(async (tx) => {
      const wh = await tx.warehouse.findFirst({
        where: { id: data.warehouseId, deletedAt: null },
        select: { id: true, kind: true, name: true, code: true },
      });

      if (!wh) {
        throw new AppError("Warehouse not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      }

      if (data.mode === "CATEGORY" && !data.categoryId) {
        throw new AppError("categoryId required for CATEGORY mode", {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { field: "categoryId" },
        });
      }

      if (data.categoryId) {
        const cat = await tx.category.findFirst({ where: { id: data.categoryId, deletedAt: null }, select: { id: true } });
        if (!cat) {
          throw new AppError("Category not found", { status: 404, code: ERROR_CODES.NOT_FOUND, details: { categoryId: data.categoryId } });
        }
      }

      const inv = await tx.stockInventory.create({
        data: {
          number: makeInventoryNumber(),
          status: "DRAFT",
          mode: (data.mode ?? "FULL") as any,
          warehouseId: data.warehouseId,
          categoryId: data.categoryId ?? null,
          note: data.note ?? null,
        } as any,
      });

      return inv;
    });
  },

  generateLines: async (inventoryId: string, opts?: { mode?: "FULL" | "CATEGORY" | "FREE"; categoryId?: string | null }) => {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.stockInventory.findUnique({
        where: { id: inventoryId },
        select: { id: true, status: true, mode: true, warehouseId: true, categoryId: true },
      });

      if (!inv) throw new AppError("Inventory not found", { status: 404, code: ERROR_CODES.NOT_FOUND });

      if (inv.status !== "DRAFT") {
        throw new AppError("Inventory not editable", { status: 400, code: ERROR_CODES.VALIDATION_ERROR, details: { status: inv.status } });
      }

      const existing = await (tx as any).stockInventoryLine.count({ where: { inventoryId: inv.id } });
      if (existing > 0) {
        throw new AppError("Lines already generated", { status: 409, code: ERROR_CODES.CONFLICT });
      }

      const mode = (opts?.mode ?? (inv.mode as any)) as "FULL" | "CATEGORY" | "FREE";
      const categoryId = opts?.categoryId ?? (inv.categoryId as any) ?? null;

      if (mode === "CATEGORY" && !categoryId) {
        throw new AppError("categoryId required for CATEGORY mode", {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { field: "categoryId" },
        });
      }

      // 1) produits ciblés
      const products = await tx.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          ...(mode === "CATEGORY" ? { categoryId } : {}),
        },
        select: { id: true },
        orderBy: { name: "asc" },
      });

      const productIds = products.map((p) => p.id);

      // 2) stock actuel (batch)
      const items = await tx.stockItem.findMany({
        where: { warehouseId: inv.warehouseId, productId: { in: productIds } },
        select: { productId: true, quantity: true },
      });

      const qtyMap = new Map(items.map((x) => [x.productId, x.quantity]));

      // 3) createMany lines
      await (tx as any).stockInventoryLine.createMany({
        data: productIds.map((pid) => ({
          inventoryId: inv.id,
          productId: pid,
          expectedQty: qtyMap.get(pid) ?? 0,
          countedQty: null,
          delta: 0,
          status: "PENDING",
          note: null,
        })),
      });

      // 4) sync header (mode/category)
      await tx.stockInventory.update({
        where: { id: inv.id },
        data: {
          mode: mode as any,
          categoryId: mode === "CATEGORY" ? (categoryId as any) : null,
        } as any,
      });

      return { ok: true, count: productIds.length };
    });
  },

  updateLine: async (inventoryId: string, lineId: string, data: { countedQty?: number; status?: "PENDING" | "COUNTED" | "SKIPPED"; note?: string | null }) => {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.stockInventory.findUnique({
        where: { id: inventoryId },
        select: { id: true, status: true },
      });

      if (!inv) throw new AppError("Inventory not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      if (inv.status !== "DRAFT") {
        throw new AppError("Inventory not editable", { status: 400, code: ERROR_CODES.VALIDATION_ERROR });
      }

      const line = await (tx as any).stockInventoryLine.findFirst({
        where: { id: lineId, inventoryId },
        select: { id: true, expectedQty: true, countedQty: true, status: true },
      });

      if (!line) throw new AppError("Inventory line not found", { status: 404, code: ERROR_CODES.NOT_FOUND });

      const countedQty = data.countedQty === undefined ? undefined : data.countedQty;
      const nextCounted = countedQty === undefined ? (line.countedQty as number | null) : countedQty;

      const nextStatus =
        data.status ??
        (nextCounted !== null && nextCounted !== undefined ? "COUNTED" : "PENDING");

      const expectedQty = Number((line as any).expectedQty ?? 0);
      const delta =
        nextCounted === null || nextCounted === undefined ? 0 : Number(nextCounted) - expectedQty;

      const updated = await (tx as any).stockInventoryLine.update({
        where: { id: lineId },
        data: {
          countedQty: countedQty === undefined ? undefined : nextCounted,
          status: nextStatus,
          delta,
          note: data.note === undefined ? undefined : data.note ?? null,
        },
      });

      return updated;
    });
  },

  post: async (inventoryId: string, data: { note: string; postedBy?: string | null }) => {
    return prisma.$transaction(async (tx) => {
      const inv = (await tx.stockInventory.findUnique({
        where: { id: inventoryId },
        include: inventoryPostInclude,
      })) as any;

      if (!inv) throw new AppError("Inventory not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      if (inv.status !== "DRAFT") {
        throw new AppError("Inventory already posted", { status: 400, code: ERROR_CODES.VALIDATION_ERROR, details: { status: inv.status } });
      }

      // garde-fou: au moins une ligne
      if (!inv.lines?.length) {
        throw new AppError("No lines to post", { status: 400, code: ERROR_CODES.VALIDATION_ERROR });
      }

      // lignes comptées = celles qui ont countedQty non null et status COUNTED
      const counted = (inv.lines as any[]).filter((l) => l.countedQty !== null && l.status !== "SKIPPED");

      // Si rien compté, c’est bizarre => refuse (sinon faille)
      if (counted.length === 0) {
        throw new AppError("Nothing counted", {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { reason: "no counted lines" },
        });
      }

      // Pour chaque ligne comptée: mettre stock = countedQty (via ADJUST delta)
      // On fait un batch du stock actuel pour calculer delta réel depuis StockItem (plus sûr).
      const productIds = counted.map((l) => l.productId);
      const stockItems = await tx.stockItem.findMany({
        where: { warehouseId: inv.warehouseId, productId: { in: productIds } },
        select: { productId: true, quantity: true },
      });

      const currentMap = new Map(stockItems.map((s) => [s.productId, Number((s as any).quantity ?? 0)]));

      const movesToCreate: any[] = [];
      for (const l of counted) {
        const currentQty = Number(currentMap.get(l.productId) ?? 0);
        const targetQty = Number((l as any).countedQty ?? 0);
        const qtyDelta = Number(targetQty) - Number(currentQty);
        if (qtyDelta === 0) continue;

        movesToCreate.push({
          kind: "ADJUST",
          warehouseId: inv.warehouseId,
          productId: l.productId,
          qtyDelta,
          refType: "INVENTORY",
          refId: inv.id,
          inventoryId: inv.id,
          note: data.note,
          transferId: null,
        });
      }

      // apply StockItem updates (upsert)
      for (const l of counted) {
        const targetQty = Number(l.countedQty);
        await tx.stockItem.upsert({
          where: { warehouseId_productId: { warehouseId: inv.warehouseId, productId: l.productId } },
          update: { quantity: targetQty },
          create: { warehouseId: inv.warehouseId, productId: l.productId, quantity: targetQty },
        });
      }

      // create moves
      if (movesToCreate.length) {
        await tx.stockMove.createMany({ data: movesToCreate });
      }

      // lock inventory
      const now = new Date();
      const posted = await tx.stockInventory.update({
        where: { id: inv.id },
        data: {
          status: "POSTED",
          postedAt: now,
          postedBy: (data.postedBy ?? null) as any,
          note: data.note,
        } as any,
      });

      return posted;
    });
  },
};