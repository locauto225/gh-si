import crypto from "crypto";
import type { CloudinarySignInput } from "./uploads.schemas";
import { AppError, ERROR_CODES } from "../../lib/errors";

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new AppError(`Missing env: ${name}`, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
  return v;
}

/**
 * Cloudinary signature:
 * - Build a string of params sorted by key: "folder=...&overwrite=...&public_id=...&timestamp=..."
 * - Append API_SECRET
 * - SHA1 hash
 */
export function signCloudinaryUpload(input: CloudinarySignInput) {
  const cloudName = mustGetEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = mustGetEnv("CLOUDINARY_API_KEY");
  const apiSecret = mustGetEnv("CLOUDINARY_API_SECRET");

  const timestamp = Math.floor(Date.now() / 1000);

  // Params used for signature must match what the client sends to Cloudinary.
  // Keep it minimal: folder, timestamp, (optional public_id), (optional overwrite).
  const params: Record<string, string> = {
    folder: input.folder,
    timestamp: String(timestamp),
  };

  if (input.publicId) params.public_id = input.publicId;
  if (input.overwrite !== undefined) params.overwrite = input.overwrite ? "true" : "false";

  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  const signature = crypto.createHash("sha1").update(sorted + apiSecret).digest("hex");

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,

    // echo back so client can send exactly same params
    folder: input.folder,
    publicId: input.publicId ?? null,
    overwrite: input.overwrite ?? true,
  };
}