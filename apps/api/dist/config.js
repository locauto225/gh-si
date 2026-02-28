"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOrigins = exports.config = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    API_PORT: zod_1.z.coerce.number().default(4001),
    // Comma-separated list of allowed origins (dev default allows Next dev ports). Note: ngrok origins are allowed automatically in app.ts.
    API_CORS_ORIGIN: zod_1.z
        .string()
        .default("http://localhost:3000,http://localhost:3001"),
});
exports.config = envSchema.parse(process.env);
exports.corsOrigins = exports.config.API_CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
