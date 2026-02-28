import { Router } from "express";
import { validate } from "../../lib/validate";
import { categoryCreateSchema } from "./categories.schemas";
import { categoriesService } from "./categories.service";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res) => {
  const items = await categoriesService.list();
  res.json({ items });
});

categoriesRouter.post("/", async (req, res) => {
  const data = validate(categoryCreateSchema, req.body);
  const item = await categoriesService.create(data);
  res.status(201).json({ item });
});