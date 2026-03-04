"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadsRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const uploads_schemas_1 = require("./uploads.schemas");
const uploads_service_1 = require("./uploads.service");
exports.uploadsRouter = (0, express_1.Router)();
/**
 * POST /uploads/cloudinary/sign
 * Body:
 *  - folder?: string (default "products")
 *  - publicId?: string
 *  - overwrite?: boolean (default true)
 *
 * Response:
 *  - cloudName, apiKey, timestamp, signature, folder, publicId, overwrite
 */
exports.uploadsRouter.post("/cloudinary/sign", async (req, res) => {
    const input = (0, validate_1.validate)(uploads_schemas_1.cloudinarySignSchema, req.body);
    const signed = (0, uploads_service_1.signCloudinaryUpload)(input);
    res.json(signed);
});
