import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4001),
  // Comma-separated list of allowed origins (dev default allows Next dev ports). Note: ngrok origins are allowed automatically in app.ts.
  API_CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000,http://localhost:3001"),
});

export const config = envSchema.parse(process.env);

export const corsOrigins = config.API_CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);