"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoicesService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
const invoices_schemas_1 = require("./invoices.schemas");
function makeInvoiceNumber(now = new Date()) {
    const y = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `INV-${y}${mm}${dd}-${rand}`;
}
function normalizeStatusFilter(raw) {
    const s = (raw ?? "").trim();
    if (!s || s === "all")
        return null;
    const parts = s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    const out = [];
    for (const p of parts) {
        if (!invoices_schemas_1.INVOICE_STATUSES.includes(p)) {
            throw new errors_1.AppError("Invalid status filter", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { status: p, allowed: [...invoices_schemas_1.INVOICE_STATUSES, "all"] },
            });
        }
        out.push(p);
    }
    return Array.from(new Set(out));
}
function computeTotals(lines) {
    const totalHT = lines.reduce((sum, l) => sum + l.qty * (l.unitPrice ?? 0), 0);
    // V1: pas de TVA/remise => TTC = HT (les frais éventuels sont portés en lignes)
    const totalTTC = totalHT;
    return { totalHT, totalTTC };
}
function buildInvoiceCreateFromSale(sale) {
    const number = makeInvoiceNumber();
    const lines = sale.lines.map((l) => ({
        productId: l.productId,
        description: l.product?.name ?? "Produit",
        qty: l.qty,
        unitPrice: l.unitPrice ?? 0,
    }));
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
        status: "DRAFT",
        saleId: sale.id,
        warehouseId: sale.warehouseId,
        clientId: sale.clientId ?? null,
        note: sale.note ?? null,
        totalHT: totals.totalHT,
        totalTTC: totals.totalTTC,
        lines,
    };
}
async function assertInvoiceExists(id) {
    const item = await prisma_1.prisma.invoice.findUnique({
        where: { id },
        include: { lines: true },
    });
    if (!item) {
        throw new errors_1.AppError("Invoice not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    }
    return item;
}
exports.invoicesService = {
    list: async (q) => {
        const statuses = normalizeStatusFilter(q.status);
        const where = {
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
        const items = await prisma_1.prisma.invoice.findMany({
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
    get: async (id) => {
        const item = await prisma_1.prisma.invoice.findUnique({
            where: { id },
            include: {
                client: true,
                warehouse: true,
                sale: true,
                lines: { include: { product: true } },
            },
        });
        if (!item) {
            throw new errors_1.AppError("Invoice not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        return { item };
    },
    create: async (data) => {
        const number = makeInvoiceNumber();
        const lines = data.lines.map((l) => ({
            productId: l.productId ? String(l.productId) : null,
            description: l.description.trim(),
            qty: l.qty,
            unitPrice: l.unitPrice ?? 0,
        }));
        const totals = computeTotals(lines);
        const item = await prisma_1.prisma.invoice.create({
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
    createFromSaleTx: async (tx, saleId) => {
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
            throw new errors_1.AppError("Sale not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
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
                throw new errors_1.AppError("Invoice linked to sale not found", {
                    status: 409,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
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
            fulfillment: sale.fulfillment ?? null,
            shippingFee: sale.shippingFee ?? 0,
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
    createFromSale: async (input) => {
        return prisma_1.prisma.$transaction((tx) => exports.invoicesService.createFromSaleTx(tx, input.saleId));
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
    setStatus: async (id, input) => {
        const invoice = await assertInvoiceExists(id);
        const current = invoice.status;
        const next = input.status;
        const allowed = {
            DRAFT: ["ISSUED", "CANCELLED"],
            ISSUED: ["SENT", "CANCELLED"],
            SENT: ["ACCEPTED", "ERROR"],
            ERROR: ["SENT", "CANCELLED"],
            ACCEPTED: [],
            CANCELLED: [],
        };
        if (!allowed[current].includes(next)) {
            throw new errors_1.AppError("Transition de statut interdite", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { from: current, to: next, allowed: allowed[current] },
            });
        }
        const data = { status: next };
        // Si on "émet" la facture, on verrouille une date d'émission (V1)
        if (next === "ISSUED" && !invoice.issuedAt) {
            data.issuedAt = new Date();
        }
        const item = await prisma_1.prisma.invoice.update({
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
