import { prisma } from "../../db/prisma";
import type { Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type {
  InvoiceCreateInput,
  InvoiceFromSaleCreateInput,
  InvoiceSetStatusInput,
  InvoicesListQuery,
  InvoiceStatus,
} from "./invoices.schemas";
import { INVOICE_STATUSES } from "./invoices.schemas";

function makeInvoiceNumber(now = new Date()) {
  const y = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${mm}${dd}-${rand}`;
}

function normalizeStatusFilter(raw: string): InvoiceStatus[] | null {
  const s = (raw ?? "").trim();
  if (!s || s === "all") return null;

  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const out: InvoiceStatus[] = [];
  for (const p of parts) {
    if (!INVOICE_STATUSES.includes(p as InvoiceStatus)) {
      throw new AppError("Invalid status filter", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { status: p, allowed: [...INVOICE_STATUSES, "all"] },
      });
    }
    out.push(p as InvoiceStatus);
  }

  return Array.from(new Set(out));
}

function computeTotals(lines: { qty: number; unitPrice: number }[]) {
  const totalHT = lines.reduce((sum, l) => sum + l.qty * (l.unitPrice ?? 0), 0);
  // V1: pas de TVA/remise => TTC = HT (les frais éventuels sont portés en lignes)
  const totalTTC = totalHT;
  return { totalHT, totalTTC };
}

function buildInvoiceCreateFromSale(sale: {
  id: string;
  warehouseId: string;
  clientId: string | null;
  note: string | null;
  fulfillment?: string | null;
  shippingFee?: number | null;
  lines: { productId: string; qty: number; unitPrice: number | null; product?: { name?: string | null } | null }[];
}) {
  const number = makeInvoiceNumber();

  const lines: Array<{ productId: string | null; description: string; qty: number; unitPrice: number }> = sale.lines.map(
    (l) => ({
      productId: l.productId,
      description: l.product?.name ?? "Produit",
      qty: l.qty,
      unitPrice: l.unitPrice ?? 0,
    })
  );

  const shippingFee = Math.max(0, Math.trunc(sale.shippingFee ?? 0));
  const isDelivery = sale.fulfillment === "DELIVERY";

  if (isDelivery && shippingFee > 0) {
    lines.push({
      productId: null,
      description: "Frais de livraison",
      qty: 1,
      unitPrice: shippingFee,
    });
  }

  const totals = computeTotals(lines);

  return {
    number,
    status: "DRAFT" as const,
    saleId: sale.id,
    warehouseId: sale.warehouseId,
    clientId: sale.clientId ?? null,
    note: sale.note ?? null,
    totalHT: totals.totalHT,
    totalTTC: totals.totalTTC,
    lines,
  };
}

async function assertInvoiceExists(id: string) {
  const item = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!item) {
    throw new AppError("Invoice not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }
  return item;
}

export const invoicesService = {
  list: async (q: InvoicesListQuery) => {
    const statuses = normalizeStatusFilter(q.status);

    const where: any = {
      ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
      ...(q.clientId ? { clientId: q.clientId } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { client: { nameSearch: { contains: q.q.toLowerCase() } } },
            ],
          }
        : {}),
    };

    const items = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
      include: {
        client: true,
        warehouse: true,
        lines: { include: { product: true } },
      },
    });

    return { items };
  },

  get: async (id: string) => {
    const item = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        warehouse: true,
        sale: true,
        lines: { include: { product: true } },
      },
    });

    if (!item) {
      throw new AppError("Invoice not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    return { item };
  },

  create: async (data: InvoiceCreateInput) => {
    const number = makeInvoiceNumber();

    const lines = data.lines.map((l) => ({
      productId: l.productId ? String(l.productId) : null,
      description: l.description.trim(),
      qty: l.qty,
      unitPrice: l.unitPrice ?? 0,
    }));

    const totals = computeTotals(lines);

    const item = await prisma.invoice.create({
      data: {
        number,
        status: "DRAFT",
        warehouseId: data.warehouseId,
        clientId: data.clientId ? String(data.clientId) : null,
        note: data.note?.trim() || null,
        totalHT: totals.totalHT,
        totalTTC: totals.totalTTC,
        lines: { create: lines },
      },
      include: {
        client: true,
        warehouse: true,
        lines: { include: { product: true } },
      },
    });

    return { item };
  },

  createFromSaleTx: async (tx: Prisma.TransactionClient, saleId: string) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        client: true,
        warehouse: true,
        lines: { include: { product: true } },
        invoice: true,
      },
    });

    if (!sale) {
      throw new AppError("Sale not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    // ✅ Réutiliser si la facture existe déjà (idempotent)
    if (sale.invoice?.id) {
      const existing = await tx.invoice.findUnique({
        where: { id: sale.invoice.id },
        include: {
          client: true,
          warehouse: true,
          sale: true,
          lines: { include: { product: true } },
        },
      });

      if (!existing) {
        // cas très rare: sale.invoiceId pointe vers une facture supprimée / incohérente
        throw new AppError("Invoice linked to sale not found", {
          status: 409,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { saleId: sale.id, invoiceId: sale.invoice.id },
        });
      }

      return { item: existing };
    }

    const data = buildInvoiceCreateFromSale({
      id: sale.id,
      warehouseId: sale.warehouseId,
      clientId: sale.clientId ?? null,
      note: sale.note ?? null,
      fulfillment: (sale as any).fulfillment ?? null,
      shippingFee: (sale as any).shippingFee ?? 0,
      lines: sale.lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice ?? 0,
        product: l.product,
      })),
    });

    const item = await tx.invoice.create({
      data: {
        number: data.number,
        status: data.status,
        saleId: data.saleId,
        warehouseId: data.warehouseId,
        clientId: data.clientId,
        note: data.note,
        totalHT: data.totalHT,
        totalTTC: data.totalTTC,
        lines: { create: data.lines },
      },
      include: {
        client: true,
        warehouse: true,
        sale: true,
        lines: { include: { product: true } },
      },
    });

    return { item };
  },

  createFromSale: async (input: InvoiceFromSaleCreateInput) => {
    return prisma.$transaction((tx) => invoicesService.createFromSaleTx(tx, input.saleId));
  },

  /**
   * Statuts (V1 "pro"):
   * - DRAFT -> ISSUED / CANCELLED
   * - ISSUED -> SENT / CANCELLED
   * - SENT -> ACCEPTED / ERROR
   * - ERROR -> SENT (re-tentative) / CANCELLED
   * - ACCEPTED -> (locked)
   * - CANCELLED -> (locked)
   */
  setStatus: async (id: string, input: InvoiceSetStatusInput) => {
    const invoice = await assertInvoiceExists(id);

    const current = invoice.status as InvoiceStatus;
    const next = input.status;

    const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
      DRAFT: ["ISSUED", "CANCELLED"],
      ISSUED: ["SENT", "CANCELLED"],
      SENT: ["ACCEPTED", "ERROR"],
      ERROR: ["SENT", "CANCELLED"],
      ACCEPTED: [],
      CANCELLED: [],
    };

    if (!allowed[current].includes(next)) {
      throw new AppError("Transition de statut interdite", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { from: current, to: next, allowed: allowed[current] },
      });
    }

    const data: any = { status: next };

    // Si on "émet" la facture, on verrouille une date d'émission (V1)
    if (next === "ISSUED" && !invoice.issuedAt) {
      data.issuedAt = new Date();
    }

    const item = await prisma.invoice.update({
      where: { id },
      data,
      include: {
        client: true,
        warehouse: true,
        sale: true,
        lines: { include: { product: true } },
      },
    });

    return { item };
  },
};