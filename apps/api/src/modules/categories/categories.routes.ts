import { Router } from "express";
import { validate } from "../../lib/validate";
import { categoryCreateSchema } from "./categories.schemas";
import { categoriesService } from "./categories.service";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (req, res) => {
  const includeSubcategories = String(req.query.includeSubcategories ?? "").toLowerCase() === "true";
  const items = await categoriesService.list({ includeSubcategories });
  res.json({ items });
});

categoriesRouter.get("/:id/subcategories", async (req, res) => {
  const categoryId = String(req.params.id);
  const items = await categoriesService.listSubcategories(categoryId);
  res.json({ items });
});

categoriesRouter.post("/", async (req, res) => {
  const data = validate(categoryCreateSchema, req.body);
  const item = await categoriesService.create(data);
  res.status(201).json({ item });
});