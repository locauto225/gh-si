// ⚠️ Adapte cet import à ton projet
// ex: import { prisma } from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";

import type { CreateDriverBody, ListDriversQuery, UpdateDriverBody } from "./drivers.schemas";

const prisma = new PrismaClient();

export async function listDrivers(q: ListDriversQuery) {
  const where: any = {
    deletedAt: null,
  };

  if (q.status === "active") where.isActive = true;
  if (q.status === "inactive") where.isActive = false;

  if (q.q && q.q.length > 0) {
    // simple search: name OR phone OR email
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { phone: { contains: q.q } },
      { email: { contains: q.q, mode: "insensitive" } },
    ];
  }

  const items = await prisma.driver.findMany({
    where,
    orderBy: { name: "asc" },
    take: q.limit,
  });

  return { items };
}

export async function createDriver(data: CreateDriverBody) {
  const created = await prisma.driver.create({
    data: {
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      isActive: data.isActive ?? true,
    },
  });
  return created;
}

export async function getDriverById(id: string) {
  const driver = await prisma.driver.findFirst({
    where: { id, deletedAt: null },
  });
  return driver;
}

export async function updateDriver(id: string, data: UpdateDriverBody) {
  const updated = await prisma.driver.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  return updated;
}