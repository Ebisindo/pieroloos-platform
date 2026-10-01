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
    workspaceId: string;
    clientId?: string;
    engagementId?: string;
    category: string;
    title: string;
    jurisdiction?: string;
    dueAt?: Date;
    status?: ComplianceStatus;
  }) {
    return prisma.complianceItem.create({
      data: {
        workspaceId: input.workspaceId,
        clientId: input.clientId,
        engagementId: input.engagementId,
        category: input.category,
        title: input.title,
        jurisdiction: input.jurisdiction,
        dueAt: input.dueAt,
        status: input.status ?? "NOT_STARTED",
      },
    });
  },

  updateStatus(id: string, status: ComplianceStatus) {
    return prisma.complianceItem.update({
      where: { id },
      data: { status },
    });
  },
};
