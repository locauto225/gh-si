import { Router } from "express";
import { validate } from "../../lib/validate";
import { ordersService } from "./orders.service";
import {
  orderCreateSchema,
  orderIdParamsSchema,
  orderQuoteSchema,
  ordersListQuerySchema,
  orderSetStatusSchema,
} from "./orders.schemas";

export const ordersRouter = Router();

// POST /orders/quote
ordersRouter.post("/quote", async (req, res) => {
  const body = validate(orderQuoteSchema, req.body);
  const result = await ordersService.quote(body);
  return res.json(result);
});

// POST /orders
ordersRouter.post("/", async (req, res) => {
  const body = validate(orderCreateSchema, req.body);
  const result = await ordersService.create(body);
  return res.status(201).json(result); // { item }
});

// GET /orders
ordersRouter.get("/", async (req, res) => {
  const q = validate(ordersListQuerySchema, {
    status: req.query.status,
    warehouseId: req.query.warehouseId,
    clientId: req.query.clientId,
    q: req.query.q,
    limit: req.query.limit,
  });

  const result = await ordersService.list(q);
  return res.json(result); // { items }
});

// GET /orders/:id
ordersRouter.get("/:id", async (req, res) => {
  const p = validate(orderIdParamsSchema, { id: req.params.id });
  const result = await ordersService.get(p.id);
  return res.json(result); // { item }
});

// PATCH /orders/:id/status
ordersRouter.patch("/:id/status", async (req, res) => {
  const p = validate(orderIdParamsSchema, { id: req.params.id });
  const body = validate(orderSetStatusSchema, req.body);
  const result = await ordersService.setStatus(p.id, body.status);
  return res.json(result); // { item }
});