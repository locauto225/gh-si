import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";

const app = createApp();

const port = Number(process.env.PORT ?? process.env.API_PORT ?? config.API_PORT ?? 4000);

app.listen(port, "0.0.0.0", () => {
  logger.info(`listening on ${port}`);
});