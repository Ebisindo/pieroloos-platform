import { prisma } from "./prisma";

export const engagementRepository = {
  findById(id: string) {
    return prisma.engagement.findUnique({ where: { id }, include: { client: true, activities: { orderBy: { createdAt: "desc" } } } });
  },
  listByWorkspace(workspaceId: string) {
    return prisma.engagement.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, include: { client: true } });
  },
  create(input: { workspaceId: string; clientId: string; service: string; nextAction?: string; notes?: string }) {
    return prisma.engagement.create({ data: input });
  },
  update(id: string, data: { service?: string; status?: "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED"; nextAction?: string; notes?: string }) {
    return prisma.engagement.update({ where: { id }, data });
  },
};
