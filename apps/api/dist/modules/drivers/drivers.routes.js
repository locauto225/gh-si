"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.driversRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const drivers_schemas_1 = require("./drivers.schemas");
const drivers_service_1 = require("./drivers.service");
// ⚠️ si tu as un middleware d’auth, mets-le ici
// import { requireAuth } from "@/middlewares/requireAuth";
exports.driversRouter = (0, express_1.Router)();
// driversRouter.use(requireAuth);
// GET /drivers?status=active
exports.driversRouter.get("/", async (req, res) => {
    const parsed = drivers_schemas_1.listDriversQuerySchema.safeParse(req.query);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    const result = await (0, drivers_service_1.listDrivers)(parsed.data);
    return res.json(result); // { items: [...] }
});
// POST /drivers
exports.driversRouter.post("/", async (req, res) => {
    const parsed = drivers_schemas_1.createDriverBodySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    const created = await (0, drivers_service_1.createDriver)(parsed.data);
    return res.status(201).json(created);
});
// GET /drivers/:id
exports.driversRouter.get("/:id", async (req, res) => {
    const id = zod_1.z.string().min(1).parse(req.params.id);
    const driver = await (0, drivers_service_1.getDriverById)(id);
    if (!driver)
        return res.status(404).json({ error: "Driver not found" });
    return res.json(driver);
});
// PATCH /drivers/:id
exports.driversRouter.patch("/:id", async (req, res) => {
    const id = zod_1.z.string().min(1).parse(req.params.id);
    const parsed = drivers_schemas_1.updateDriverBodySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    // Optionnel: vérifier existence + deletedAt null
    const existing = await (0, drivers_service_1.getDriverById)(id);
    if (!existing)
        return res.status(404).json({ error: "Driver not found" });
    const updated = await (0, drivers_service_1.updateDriver)(id, parsed.data);
    return res.json(updated);
});
