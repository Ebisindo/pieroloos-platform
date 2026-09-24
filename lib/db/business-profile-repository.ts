import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { BusinessProfileUpdateInput } from "@/lib/validation/business-profile";

export const businessProfileRepository = {
  async findByClientId(clientId: string) {
    return prisma.businessProfile.findUnique({
      where: { clientId },
      include: { client: true },
    });
  },

  async update(id: string, data: BusinessProfileUpdateInput) {
    const existing = await prisma.businessProfile.findUnique({
      where: { id },
      select: { data: true },
    });

    const current =
      existing?.data &&
      typeof existing.data === "object" &&
      !Array.isArray(existing.data)
        ? (existing.data as Record<string, unknown>)
        : {};

    const merged = Object.fromEntries(
      Object.entries({ ...current, ...data }).filter(([, value]) => value !== undefined),
    ) as Prisma.InputJsonObject;

    return prisma.businessProfile.update({
      where: { id },
      data: {
        data: merged,
        version: { increment: 1 },
      },
    });
  },
};
