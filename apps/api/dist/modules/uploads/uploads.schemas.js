"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinarySignSchema = void 0;
const zod_1 = require("zod");
exports.cloudinarySignSchema = zod_1.z.object({
    // Optionnel : pour ranger les images (ex: "products", "products/dev")
    folder: zod_1.z.string().trim().min(1).max(200).optional().default("products"),
    // Optionnel : si tu veux imposer un identifiant stable (ex: productId)
    // Cloudinary utilisera exactement ce public_id (utile pour remplacer une image)
    publicId: zod_1.z.string().trim().min(1).max(200).optional(),
    // Optionnel : autoriser écrasement (si publicId fourni)
    overwrite: zod_1.z.boolean().optional().default(true),
});
