import { Router } from "express";
import { z } from "zod";

import {
  createDriverBodySchema,
  listDriversQuerySchema,
  updateDriverBodySchema,
} from "./drivers.schemas";
import { createDriver, getDriverById, listDrivers, updateDriver } from "./drivers.service";

// ⚠️ si tu as un middleware d’auth, mets-le ici
// import { requireAuth } from "@/middlewares/requireAuth";

export const driversRouter = Router();

// driversRouter.use(requireAuth);

// GET /drivers?status=active
driversRouter.get("/", async (req, res) => {
  const parsed = listDriversQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });

  const result = await listDrivers(parsed.data);
  return res.json(result); // { items: [...] }
});

// POST /drivers
driversRouter.post("/", async (req, res) => {
  const parsed = createDriverBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  const created = await createDriver(parsed.data);
  return res.status(201).json(created);
});

// GET /drivers/:id
driversRouter.get("/:id", async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const driver = await getDriverById(id);
  if (!driver) return res.status(404).json({ error: "Driver not found" });

  return res.json(driver);
});

// PATCH /drivers/:id
driversRouter.patch("/:id", async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);

  const parsed = updateDriverBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  // Optionnel: vérifier existence + deletedAt null
  const existing = await getDriverById(id);
  if (!existing) return res.status(404).json({ error: "Driver not found" });

  const updated = await updateDriver(id, parsed.data);
  return res.json(updated);
});