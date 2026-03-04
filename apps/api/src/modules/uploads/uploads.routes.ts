import { Router } from "express";
import { validate } from "../../lib/validate";
import { cloudinarySignSchema } from "./uploads.schemas";
import { signCloudinaryUpload } from "./uploads.service";

export const uploadsRouter = Router();

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
uploadsRouter.post("/cloudinary/sign", async (req, res) => {
  const input = validate(cloudinarySignSchema, req.body);
  const signed = signCloudinaryUpload(input);
  res.json(signed);
});