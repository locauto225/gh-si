"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryTripsService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function year() {
    return new Date().getFullYear();
}
function makeTripNumber(seq) {
    // TRIP-2026-0001
    const n = String(seq).padStart(4, "0");
    return `TRIP-${year()}-${n}`;
}
async function nextTripSeqTx(tx) {
    // Simple: compte les trips de l’année. OK pour V1.
    // (Si tu veux “par entrepôt”, on adaptera)
    const count = await tx.deliveryTrip.count({
        where: {
            number: { startsWith: `TRIP-${year()}-` },
        },
    });
    return count + 1;
}
const includeTripFull = {
    fromWarehouse: true,
    driver: true,
    stops: {
        orderBy: { sequence: "asc" },
        include: {
            client: true,
            store: true,
            stopSales: {
                include: {
                    sale: { include: { client: true, store: true, warehouse: true } },
                },
            },
            payments: { orderBy: { createdAt: "asc" } },
            deliveries: {
                include: {
                    sale: { include: { client: true } },
                    lines: { include: { saleLine: { include: { product: true } } } },
                    items: { include: { product: true } },
                },
            },
        },
    },
    deliveries: {
        include: {
            sale: { include: { client: true } },
            lines: { include: { saleLine: { include: { product: true } } } },
            items: { include: { product: true } },
        },
    },
};
async function assertTripExists(id) {
    const item = await prisma_1.prisma.deliveryTrip.findUnique({
        where: { id },
        include: includeTripFull,
    });
    if (!item) {
        throw new errors_1.AppError("Tournée introuvable", {
            status: 404,
            code: errors_1.ERROR_CODES.NOT_FOUND,
            details: { id },
        });
    }
    return item;
}
async function assertStopExists(stopId) {
    const item = await prisma_1.prisma.deliveryStop.findUnique({
        where: { id: stopId },
        include: {
            trip: { include: { fromWarehouse: true, driver: true } },
            client: true,
            store: true,
            stopSales: { include: { sale: { include: { client: true } } } },
            payments: { orderBy: { createdAt: "asc" } },
            deliveries: true,
        },
    });
    if (!item) {
        throw new errors_1.AppError("Arrêt introuvable", {
            status: 404,
            code: errors_1.ERROR_CODES.NOT_FOUND,
            details: { stopId },
        });
    }
    return item;
}
exports.deliveryTripsService = {
    list: async (q) => {
        const take = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 200);
        const where = {};
        if (q.status)
            where.status = q.status;
        if (q.fromWarehouseId)
            where.fromWarehouseId = q.fromWarehouseId;
        if (q.driverId)
            where.driverId = q.driverId;
        const items = await prisma_1.prisma.deliveryTrip.findMany({
            where,
            take,
            orderBy: { createdAt: "desc" },
            include: {
                fromWarehouse: true,
                driver: true,
                _count: { select: { stops: true, deliveries: true } },
            },
        });
        return { items };
    },
    get: async (id) => {
        const item = await assertTripExists(id);
        return { item };
    },
    create: async (input) => {
        const item = await prisma_1.prisma.$transaction(async (tx) => {
            const seq = await nextTripSeqTx(tx);
            const number = makeTripNumber(seq);
            // Vérifs simples d’existence
            const wh = await tx.warehouse.findUnique({ where: { id: input.fromWarehouseId }, select: { id: true } });
            if (!wh) {
                throw new errors_1.AppError("Entrepôt introuvable", {
                    status: 404,
                    code: errors_1.ERROR_CODES.NOT_FOUND,
                    details: { fromWarehouseId: input.fromWarehouseId },
                });
            }
            if (input.driverId) {
                const dr = await tx.driver.findUnique({ where: { id: input.driverId }, select: { id: true } });
                if (!dr) {
                    throw new errors_1.AppError("Livreur introuvable", {
                        status: 404,
                        code: errors_1.ERROR_CODES.NOT_FOUND,
                        details: { driverId: input.driverId },
                    });
                }
            }
            return tx.deliveryTrip.create({
                data: {
                    number,
                    status: "DRAFT",
                    fromWarehouseId: input.fromWarehouseId,
                    driverId: input.driverId ?? null,
                    note: input.note ?? null,
                },
                include: includeTripFull,
            });
        });
        return { item };
    },
    setStatus: async (id, input) => {
        await assertTripExists(id);
        const now = new Date();
        const data = {
            status: input.status,
        };
        if (input.note !== undefined)
            data.note = input.note;
        if (input.status === "IN_PROGRESS")
            data.startedAt = now;
        if (input.status === "CLOSED")
            data.closedAt = now;
        const item = await prisma_1.prisma.deliveryTrip.update({
            where: { id },
            data,
            include: includeTripFull,
        });
        return { item };
    },
    addStop: async (tripId, input) => {
        await assertTripExists(tripId);
        const item = await prisma_1.prisma.$transaction(async (tx) => {
            // sequence : auto append si absent
            let sequence = input.sequence;
            if (!sequence) {
                const max = await tx.deliveryStop.aggregate({
                    where: { tripId },
                    _max: { sequence: true },
                });
                sequence = (max._max.sequence ?? 0) + 1;
            }
            // Vérifs optionnelles
            if (input.clientId) {
                const c = await tx.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
                if (!c)
                    throw new errors_1.AppError("Client introuvable", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            }
            if (input.storeId) {
                const s = await tx.store.findUnique({ where: { id: input.storeId }, select: { id: true } });
                if (!s)
                    throw new errors_1.AppError("Magasin introuvable", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            }
            // Stop
            const stop = await tx.deliveryStop.create({
                data: {
                    tripId,
                    sequence,
                    status: "PENDING",
                    clientId: input.clientId ?? null,
                    storeId: input.storeId ?? null,
                    addressSnapshot: input.addressSnapshot ?? null,
                    phoneSnapshot: input.phoneSnapshot ?? null,
                    contactNameSnapshot: input.contactNameSnapshot ?? null,
                    note: input.note ?? null,
                },
            });
            // Lier des ventes (Option A)
            const saleIds = input.saleIds ?? [];
            const uniqueSaleIds = [...new Set(saleIds)];
            if (uniqueSaleIds.length > 0) {
                // vérifier existence des ventes
                const found = await tx.sale.findMany({ where: { id: { in: uniqueSaleIds } }, select: { id: true } });
                const foundSet = new Set(found.map((x) => x.id));
                const missing = uniqueSaleIds.filter((x) => !foundSet.has(x));
                if (missing.length > 0) {
                    throw new errors_1.AppError("Ventes introuvables", {
                        status: 404,
                        code: errors_1.ERROR_CODES.NOT_FOUND,
                        details: { missing },
                    });
                }
                await tx.stopSale.createMany({
                    data: uniqueSaleIds.map((saleId) => ({ stopId: stop.id, saleId })),
                });
            }
            // Return full trip
            return tx.deliveryTrip.findUnique({ where: { id: tripId }, include: includeTripFull });
        });
        return { item };
    },
    setStopStatus: async (stopId, input) => {
        const stop = await assertStopExists(stopId);
        const data = {
            status: input.status,
        };
        if (input.note !== undefined)
            data.note = input.note;
        if (input.visitedAt)
            data.visitedAt = input.visitedAt;
        else if (["VISITED", "PARTIAL", "DONE", "FAILED"].includes(input.status))
            data.visitedAt = new Date();
        await prisma_1.prisma.deliveryStop.update({
            where: { id: stopId },
            data,
        });
        // renvoyer la tournée full (pratique UI)
        const item = await prisma_1.prisma.deliveryTrip.findUnique({
            where: { id: stop.tripId },
            include: includeTripFull,
        });
        return { item };
    },
    addStopPayment: async (stopId, input) => {
        const stop = await assertStopExists(stopId);
        await prisma_1.prisma.stopPayment.create({
            data: {
                stopId,
                method: input.method,
                amount: input.amount,
                reference: input.reference ?? null,
                note: input.note ?? null,
                receivedAt: input.receivedAt ?? new Date(),
            },
        });
        const item = await prisma_1.prisma.deliveryTrip.findUnique({
            where: { id: stop.tripId },
            include: includeTripFull,
        });
        return { item };
    },
    // Bulk attach deliveries to a stop (dispatch depuis l'arrêt)
    addDeliveriesToStop: async (stopId, input) => {
        const stop = await assertStopExists(stopId);
        const deliveryIds = [...new Set(input.deliveryIds ?? [])];
        if (deliveryIds.length === 0) {
            throw new errors_1.AppError("Aucun BL sélectionné", { status: 400, code: errors_1.ERROR_CODES.VALIDATION_ERROR });
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            // Vérifier existence BL
            const found = await tx.delivery.findMany({
                where: { id: { in: deliveryIds } },
                select: { id: true, tripId: true, stopId: true },
            });
            const foundSet = new Set(found.map((x) => x.id));
            const missing = deliveryIds.filter((id) => !foundSet.has(id));
            if (missing.length > 0) {
                throw new errors_1.AppError("Bons de livraison introuvables", {
                    status: 404,
                    code: errors_1.ERROR_CODES.NOT_FOUND,
                    details: { missing },
                });
            }
            // Refuser les BL déjà affectés à une autre tournée / arrêt
            const conflicts = found.filter((d) => {
                const otherTrip = d.tripId && d.tripId !== stop.tripId;
                const otherStop = d.stopId && d.stopId !== stop.id;
                return Boolean(otherTrip || otherStop);
            });
            if (conflicts.length > 0) {
                throw new errors_1.AppError("Certains BL sont déjà affectés", {
                    status: 409,
                    code: errors_1.ERROR_CODES.CONFLICT,
                    details: {
                        conflicts: conflicts.map((d) => ({ id: d.id, tripId: d.tripId, stopId: d.stopId })),
                    },
                });
            }
            // Attacher en bulk
            await tx.delivery.updateMany({
                where: { id: { in: deliveryIds } },
                data: {
                    tripId: stop.tripId,
                    stopId: stop.id,
                },
            });
        });
        // Retourner la tournée full (pratique UI)
        const item = await prisma_1.prisma.deliveryTrip.findUnique({
            where: { id: stop.tripId },
            include: includeTripFull,
        });
        return { item };
    },
};
