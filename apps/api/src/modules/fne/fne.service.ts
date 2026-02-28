import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type { Prisma } from "@prisma/client";
import type { FneEventCreateInput, FneEventsListQuery } from "./fne.schemas";

// Prisma schema in this repo does not export a FneStatus enum; keep a local type for TS/build.
type FneStatus = "PENDING" | "SENT" | "ACCEPTED" | "ERROR";

async function assertInvoiceExists(tx: Prisma.TransactionClient, id: string) {
  const inv = await tx.invoice.findUnique({ where: { id } });
  if (!inv) throw new AppError("Invoice not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  return inv;
}

async function assertSaleExists(tx: Prisma.TransactionClient, id: string) {
  const sale = await tx.sale.findUnique({ where: { id } });
  if (!sale) throw new AppError("Sale not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  return sale;
}

export const fneService = {
  /**
   * Historique d’événements (facture ou vente)
   */
  listEvents: async (q: FneEventsListQuery) => {
    const where: any = {
      ...(q.status ? { status: q.status } : {}),
    };

    if (q.entity === "invoice") {
      where.invoiceId = q.entityId ? q.entityId : { not: null };
    } else if (q.entity === "sale") {
      where.saleId = q.entityId ? q.entityId : { not: null };
    } else if (q.entityId) {
      // si entity non fourni mais entityId fourni => on tente invoiceId OR saleId
      where.OR = [{ invoiceId: q.entityId }, { saleId: q.entityId }];
    }

    const items = await prisma.fneEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
      include: {
        invoice: { select: { id: true, number: true, status: true, fneStatus: true, fneRef: true } },
        sale: { select: { id: true, number: true, status: true, fneStatus: true, fneRef: true } },
      },
    });

    return { items };
  },

  /**
   * Création manuelle (simulateur / audit)
   * + sync des champs fneStatus/fneSentAt/fneRef sur la facture/vente pour rendre le SI “vivant” sans API DGI.
   */
  createEvent: async (input: FneEventCreateInput) => {
    const status = input.status as FneStatus;

    return prisma.$transaction(async (tx) => {
      if (input.invoiceId) await assertInvoiceExists(tx, input.invoiceId);
      if (input.saleId) await assertSaleExists(tx, input.saleId);

      const ev = await tx.fneEvent.create({
        data: {
          invoiceId: input.invoiceId ?? null,
          saleId: input.saleId ?? null,
          status,
          payloadHash: input.payloadHash ?? null,
          request: input.request ?? null,
          response: input.response ?? null,
          error: input.error ?? null,
        },
        include: {
          invoice: { select: { id: true, number: true, status: true, fneStatus: true, fneRef: true } },
          sale: { select: { id: true, number: true, status: true, fneStatus: true, fneRef: true } },
        },
      });

      const now = new Date();

      // Sync côté Invoice
      if (input.invoiceId) {
        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            fneStatus: status,
            ...(status === "SENT" ? { fneSentAt: now } : {}),
            ...(input.fneRef ? { fneRef: input.fneRef } : {}),
          },
        });
      }

      // Sync côté Sale
      if (input.saleId) {
        await tx.sale.update({
          where: { id: input.saleId },
          data: {
            fneStatus: status,
            ...(status === "SENT" ? { fneSentAt: now } : {}),
            ...(input.fneRef ? { fneRef: input.fneRef } : {}),
          },
        });
      }

      return { item: ev };
    });
  },

  /**
   * Envoi "métier" d'une facture vers la FNE (sans API DGI pour l'instant).
   * V1: on crée un event PENDING et on synchronise invoice.fneStatus (+ fneSentAt).
   * Idempotent: si la facture est déjà ACCEPTED ou SENT/PENDING, on peut renvoyer une erreur claire.
   */
  sendInvoice: async (invoiceId: string) => {
    const id = String(invoiceId ?? "").trim();
    if (!id) {
      throw new AppError("invoiceId requis", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    return prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id } });
      if (!inv) {
        throw new AppError("Invoice not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      }

      // Règles simples (V1) pour éviter les erreurs humaines
      if (inv.status === "DRAFT" || inv.status === "CANCELLED") {
        throw new AppError("Facture non éligible à l'envoi FNE", {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { status: inv.status },
        });
      }
      if (inv.fneStatus === "ACCEPTED") {
        throw new AppError("Facture déjà acceptée par la FNE", {
          status: 409,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { fneStatus: inv.fneStatus },
        });
      }
      if (inv.fneStatus === "PENDING" || inv.fneStatus === "SENT") {
        throw new AppError("Envoi FNE déjà en cours / déjà envoyé", {
          status: 409,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { fneStatus: inv.fneStatus },
        });
      }

      const now = new Date();

      const ev = await tx.fneEvent.create({
        data: {
          invoiceId: id,
          saleId: null,
          status: "PENDING",
          payloadHash: null,
          request: null,
          response: null,
          error: null,
        },
        include: {
          invoice: {
            select: { id: true, number: true, status: true, fneStatus: true, fneRef: true },
          },
          sale: {
            select: { id: true, number: true, status: true, fneStatus: true, fneRef: true },
          },
        },
      });

      await tx.invoice.update({
        where: { id },
        data: {
          fneStatus: "PENDING",
          fneSentAt: now,
        },
      });

      return { item: ev };
    });
  },

  /**
   * Summary pour page Fiscal: focus facture (car finalité FNE).
   * Tu peux élargir aux ventes plus tard.
   */
  summary: async () => {
    const [total, none, pending, sent, accepted, error] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({ where: { fneStatus: null } }),
      prisma.invoice.count({ where: { fneStatus: "PENDING" } }),
      prisma.invoice.count({ where: { fneStatus: "SENT" } }),
      prisma.invoice.count({ where: { fneStatus: "ACCEPTED" } }),
      prisma.invoice.count({ where: { fneStatus: "ERROR" } }),
    ]);

    // “À traiter” = factures émises/verrouillées mais pas acceptées
    // Ajuste selon ton process : ISSUED / SENT / ERROR
    const toProcess = await prisma.invoice.count({
      where: {
        status: { in: ["ISSUED", "SENT", "ERROR"] as any },
        NOT: { fneStatus: "ACCEPTED" },
      },
    });

    return {
      total,
      toProcess,
      byFneStatus: { none, pending, sent, accepted, error },
    };
  },
};