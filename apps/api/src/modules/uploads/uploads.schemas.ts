import { z } from "zod";

export const cloudinarySignSchema = z.object({
  // Optionnel : pour ranger les images (ex: "products", "products/dev")
  folder: z.string().trim().min(1).max(200).optional().default("products"),

  // Optionnel : si tu veux imposer un identifiant stable (ex: productId)
  // Cloudinary utilisera exactement ce public_id (utile pour remplacer une image)
  publicId: z.string().trim().min(1).max(200).optional(),

  // Optionnel : autoriser écrasement (si publicId fourni)
  overwrite: z.boolean().optional().default(true),
});

export type CloudinarySignInput = z.infer<typeof cloudinarySignSchema>;