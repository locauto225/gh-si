import { PrismaClient } from "@prisma/client";

// Simple singleton for the API process.
export const prisma = new PrismaClient();
