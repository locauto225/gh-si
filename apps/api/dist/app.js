"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const health_routes_1 = require("./modules/health/health.routes");
const products_routes_1 = require("./modules/products/products.routes");
const categories_routes_1 = require("./modules/categories/categories.routes");
const warehouses_routes_1 = require("./modules/warehouses/warehouses.routes");
const stock_routes_1 = require("./modules/stock/stock.routes");
const inventories_routes_1 = require("./modules/inventories/inventories.routes");
const purchases_routes_1 = require("./modules/purchases/purchases.routes");
const suppliers_routes_1 = require("./modules/suppliers/suppliers.routes");
const clients_routes_1 = require("./modules/clients/clients.routes");
const sales_routes_1 = require("./modules/sales/sales.routes");
const sale_payments_routes_1 = require("./modules/sale-payments/sale-payments.routes");
const invoices_routes_1 = require("./modules/invoices/invoices.routes");
const invoice_payments_routes_1 = require("./modules/invoice-payments/invoice-payments.routes");
const orders_routes_1 = require("./modules/orders/orders.routes");
const deliveries_routes_1 = require("./modules/deliveries/deliveries.routes");
const drivers_routes_1 = require("./modules/drivers/drivers.routes");
const pos_receipts_routes_1 = require("./modules/pos-receipts/pos-receipts.routes");
const delivery_trips_routes_1 = require("./modules/delivery-trips/delivery-trips.routes");
const stop_payments_routes_1 = require("./modules/stop-payments/stop-payments.routes");
const fne_routes_1 = require("./modules/fne/fne.routes");
const dashboard_routes_1 = require("./modules/dashboard/dashboard.routes");
const stores_routes_1 = require("./modules/stores/stores.routes");
const pricelists_routes_1 = require("./modules/pricelists/pricelists.routes");
const errors_1 = require("./lib/errors");
function createApp() {
    const app = (0, express_1.default)();
    const corsOptions = {
        origin: (origin, cb) => {
            // allow non-browser clients (curl, server-to-server)
            if (!origin)
                return cb(null, true);
            // allow explicit configured origins
            if (config_1.corsOrigins.includes(origin))
                return cb(null, true);
            // allow temporary public origins when using ngrok
            try {
                const { hostname } = new URL(origin);
                if (hostname.endsWith(".ngrok-free.app") || hostname.endsWith(".ngrok.app")) {
                    return cb(null, true);
                }
            }
            catch {
                // ignore invalid origin
            }
            return cb(null, false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    };
    app.use((0, cors_1.default)(corsOptions));
    // Important: answer CORS preflight requests (OPTIONS) before hitting routers/notFound
    app.options(/.*/, (0, cors_1.default)(corsOptions));
    app.use(express_1.default.json({ limit: "2mb" }));
    app.get("/", (_req, res) => res.json({ name: "GH-SI API", ok: true }));
    app.use("/health", health_routes_1.healthRouter);
    app.use("/products", products_routes_1.productsRouter);
    app.use("/categories", categories_routes_1.categoriesRouter);
    app.use("/warehouses", warehouses_routes_1.warehousesRouter);
    app.use("/stores", stores_routes_1.storesRouter);
    app.use("/pricelists", pricelists_routes_1.pricelistsRouter);
    app.use("/stock", stock_routes_1.stockRouter);
    app.use("/stock/inventories", inventories_routes_1.inventoriesRouter);
    app.use("/purchases", purchases_routes_1.purchasesRouter);
    app.use("/suppliers", suppliers_routes_1.suppliersRouter);
    app.use("/clients", clients_routes_1.clientsRouter);
    app.use("/sales", sales_routes_1.salesRouter);
    app.use("/sales", sale_payments_routes_1.salePaymentsRouter);
    app.use("/invoices", invoices_routes_1.invoicesRouter);
    app.use("/invoices", invoice_payments_routes_1.invoicePaymentsRouter);
    app.use("/orders", orders_routes_1.ordersRouter);
    app.use("/deliveries", deliveries_routes_1.deliveriesRouter);
    app.use("/drivers", drivers_routes_1.driversRouter);
    app.use("/pos/receipts", pos_receipts_routes_1.posReceiptsRouter);
    app.use("/delivery-trips", delivery_trips_routes_1.deliveryTripsRouter);
    app.use("/stop-payments", stop_payments_routes_1.stopPaymentsRouter);
    app.use("/fne", fne_routes_1.fneRouter);
    app.use("/dashboard", dashboard_routes_1.dashboardRouter);
    app.use(errors_1.notFound);
    app.use(errors_1.errorHandler);
    return app;
}
