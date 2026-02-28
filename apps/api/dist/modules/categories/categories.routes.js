"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const categories_schemas_1 = require("./categories.schemas");
const categories_service_1 = require("./categories.service");
exports.categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter.get("/", async (_req, res) => {
    const items = await categories_service_1.categoriesService.list();
    res.json({ items });
});
exports.categoriesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(categories_schemas_1.categoryCreateSchema, req.body);
    const item = await categories_service_1.categoriesService.create(data);
    res.status(201).json({ item });
});
