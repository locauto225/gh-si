import express from "express";
import cors from "cors";
import { config, corsOrigins } from "./config";
import { healthRouter } from "./modules/health/health.routes";
import { productsRouter } from "./modules/products/products.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { warehousesRouter } from "./modules/warehouses/warehouses.routes";
import { stockRouter } from "./modules/stock/stock.routes";
import { inventoriesRouter } from "./modules/inventories/inventories.routes";
import { purchasesRouter } from "./modules/purchases/purchases.routes";
import { suppliersRouter } from "./modules/suppliers/suppliers.routes";
import { clientsRouter } from "./modules/clients/clients.routes";
import { salesRouter } from "./modules/sales/sales.routes";
import { salePaymentsRouter } from "./modules/sale-payments/sale-payments.routes";
import { invoicesRouter } from "./modules/invoices/invoices.routes";
import { invoicePaymentsRouter } from "./modules/invoice-payments/invoice-payments.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { deliveriesRouter } from "./modules/deliveries/deliveries.routes";
import { driversRouter } from "./modules/drivers/drivers.routes";
import { posReceiptsRouter } from "./modules/pos-receipts/pos-receipts.routes";
import { deliveryTripsRouter } from "./modules/delivery-trips/delivery-trips.routes";
import { stopPaymentsRouter } from "./modules/stop-payments/stop-payments.routes";
import { fneRouter } from "./modules/fne/fne.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { storesRouter } from "./modules/stores/stores.routes";
import { pricelistsRouter } from "./modules/pricelists/pricelists.routes";
import { errorHandler, notFound } from "./lib/errors";

export function createApp() {
  const app = express();

  const corsOptions: cors.CorsOptions = {
    origin: (origin, cb) => {
      // allow non-browser clients (curl, server-to-server)
      if (!origin) return cb(null, true);

      // allow explicit configured origins
      if (corsOrigins.includes(origin)) return cb(null, true);

      // allow temporary public origins when using ngrok
      try {
        const { hostname } = new URL(origin);
        if (hostname.endsWith(".ngrok-free.app") || hostname.endsWith(".ngrok.app")) {
          return cb(null, true);
        }
      } catch {
        // ignore invalid origin
      }

      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };

  app.use(cors(corsOptions));
  // Important: answer CORS preflight requests (OPTIONS) before hitting routers/notFound
  app.options(/.*/, cors(corsOptions));

  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req, res) => res.json({ name: "GH-SI API", ok: true }));
  app.use("/health", healthRouter);
  app.use("/products", productsRouter);
  app.use("/categories", categoriesRouter);
  app.use("/warehouses", warehousesRouter);
  app.use("/stores", storesRouter);
  app.use("/pricelists", pricelistsRouter);
  app.use("/stock", stockRouter);
  app.use("/stock/inventories", inventoriesRouter);
  app.use("/purchases", purchasesRouter);
  app.use("/suppliers", suppliersRouter);
  app.use("/clients", clientsRouter);
  app.use("/sales", salesRouter);
  app.use("/sales", salePaymentsRouter);
  app.use("/invoices", invoicesRouter);
  app.use("/invoices", invoicePaymentsRouter);
  app.use("/orders", ordersRouter);
  app.use("/deliveries", deliveriesRouter);
  app.use("/drivers", driversRouter);
  app.use("/pos/receipts", posReceiptsRouter);
  app.use("/delivery-trips", deliveryTripsRouter);
  app.use("/stop-payments", stopPaymentsRouter);
  app.use("/fne", fneRouter);
  app.use("/dashboard", dashboardRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}