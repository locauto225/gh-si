"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logger = {
    info: (...args) => console.log("[api]", ...args),
    warn: (...args) => console.warn("[api]", ...args),
    error: (...args) => console.error("[api]", ...args),
};
