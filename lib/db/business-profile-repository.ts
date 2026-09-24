import { prisma } from "@/lib/db/prisma";
import type { BusinessProfileUpdateInput } from "@/lib/validation/business-profile";

export const businessProfileRepository = {
  async findByClientId(clientId: string) {
    return prisma.businessProfile.findUnique({
      where: { clientId },
      include: { client: true },
    });
  },

  async update(id: string, data: BusinessProfileUpdateInput) {
    return prisma.businessProfile.update({
      where: { id },
      data,
    });
  },
};
