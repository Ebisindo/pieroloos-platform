import { prisma } from "./prisma";
import type { ComplianceStatus } from "@prisma/client";

export const complianceRepository = {
  listByEngagement(engagementId: string) {
    return prisma.complianceItem.findMany({
      where: { engagementId },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    });
  },

  create(input: {
    engagementId?: string;
    category: string;
    title: string;
    jurisdiction?: string;
    dueAt?: Date;
  }) {
    return prisma.complianceItem.create({ data: input });
  },

  updateStatus(id: string, status: ComplianceStatus) {
    return prisma.complianceItem.update({
      where: { id },
      data: { status },
    });
  },
};
