"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryCreateSchema = void 0;
const zod_1 = require("zod");
exports.categoryCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80),
});
