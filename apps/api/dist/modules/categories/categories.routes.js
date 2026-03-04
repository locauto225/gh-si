"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const categories_schemas_1 = require("./categories.schemas");
const categories_service_1 = require("./categories.service");
const prisma_1 = require("../../db/prisma");
exports.categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter.get("/", async (req, res) => {
    const includeSubcategories = String(req.query.includeSubcategories ?? "").toLowerCase() === "true";
    const items = await categories_service_1.categoriesService.list({ includeSubcategories });
    res.json({ items });
});
// POST avant GET /:id pour éviter le conflit de route Express
exports.categoriesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(categories_schemas_1.categoryCreateSchema, req.body);
    const item = await categories_service_1.categoriesService.create(data);
    res.status(201).json({ item });
});
exports.categoriesRouter.get("/:id/subcategories", async (req, res) => {
    const categoryId = String(req.params.id);
    const items = await categories_service_1.categoriesService.listSubcategories(categoryId);
    res.json({ items });
});
exports.categoriesRouter.post("/:id/subcategories", async (req, res) => {
    const categoryId = String(req.params.id);
    const data = (0, validate_1.validate)(categories_schemas_1.subCategoryCreateSchema, { ...req.body, categoryId });
    const item = await categories_service_1.categoriesService.createSubcategory(data);
    res.status(201).json({ item });
});
// Suppression SAFE (soft-delete)
// - on garde l'historique (audit)
// - on ne casse pas les références existantes
exports.categoriesRouter.delete("/:id", async (req, res) => {
    const id = String(req.params.id);
    // 404 si la catégorie n'existe pas
    const existing = await prisma_1.prisma.category.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!existing) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    }
    const now = new Date();
    // Archive la catégorie
    await prisma_1.prisma.category.update({
        where: { id },
        data: { isActive: false, deletedAt: now },
    });
    // Archive ses sous-catégories (si elles existent)
    await prisma_1.prisma.subCategory.updateMany({
        where: { categoryId: id, deletedAt: null },
        data: { isActive: false, deletedAt: now },
    });
    return res.status(204).send();
});
exports.categoriesRouter.delete("/:id/subcategories/:subId", async (req, res) => {
    const categoryId = String(req.params.id);
    const subId = String(req.params.subId);
    // Vérifie l'appartenance
    const existing = await prisma_1.prisma.subCategory.findFirst({
        where: { id: subId, categoryId },
        select: { id: true },
    });
    if (!existing) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    }
    const now = new Date();
    // Safe delete : on archive (soft-delete)
    await prisma_1.prisma.subCategory.update({
        where: { id: subId },
        data: { isActive: false, deletedAt: now },
    });
    return res.status(204).send();
});
