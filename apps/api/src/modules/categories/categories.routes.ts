import { Router } from "express";
import { validate } from "../../lib/validate";
import { categoryCreateSchema, subCategoryCreateSchema } from "./categories.schemas";
import { categoriesService } from "./categories.service";
import { prisma } from "../../db/prisma";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (req, res) => {
  const includeSubcategories = String(req.query.includeSubcategories ?? "").toLowerCase() === "true";
  const items = await categoriesService.list({ includeSubcategories });
  res.json({ items });
});

// POST avant GET /:id pour éviter le conflit de route Express
categoriesRouter.post("/", async (req, res) => {
  const data = validate(categoryCreateSchema, req.body);
  const item = await categoriesService.create(data);
  res.status(201).json({ item });
});

categoriesRouter.get("/:id/subcategories", async (req, res) => {
  const categoryId = String(req.params.id);
  const items = await categoriesService.listSubcategories(categoryId);
  res.json({ items });
});

categoriesRouter.post("/:id/subcategories", async (req, res) => {
  const categoryId = String(req.params.id);
  const data = validate(subCategoryCreateSchema, { ...req.body, categoryId });
  const item = await categoriesService.createSubcategory(data);
  res.status(201).json({ item });
});

// Suppression SAFE (soft-delete)
// - on garde l'historique (audit)
// - on ne casse pas les références existantes
categoriesRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id);

  // 404 si la catégorie n'existe pas
  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
  }

  const now = new Date();

  // Archive la catégorie
  await prisma.category.update({
    where: { id },
    data: { isActive: false, deletedAt: now },
  });

  // Archive ses sous-catégories (si elles existent)
  await prisma.subCategory.updateMany({
    where: { categoryId: id, deletedAt: null },
    data: { isActive: false, deletedAt: now },
  });

  return res.status(204).send();
});

categoriesRouter.delete("/:id/subcategories/:subId", async (req, res) => {
  const categoryId = String(req.params.id);
  const subId = String(req.params.subId);

  // Vérifie l'appartenance
  const existing = await prisma.subCategory.findFirst({
    where: { id: subId, categoryId },
    select: { id: true },
  });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
  }

  const now = new Date();

  // Safe delete : on archive (soft-delete)
  await prisma.subCategory.update({
    where: { id: subId },
    data: { isActive: false, deletedAt: now },
  });

  return res.status(204).send();
});