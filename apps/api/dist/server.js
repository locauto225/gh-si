"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const logger_1 = require("./lib/logger");
const app = (0, app_1.createApp)();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? config_1.config.API_PORT ?? 4000);
app.listen(port, () => {
    logger_1.logger.info(`listening on http://localhost:${port}`);
});
