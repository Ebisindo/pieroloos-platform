import { prisma } from "./prisma";

export const clientRepository = {
  findById(id: string) {
    return prisma.client.findUnique({ include: { businessProfile: true, engagements: true }, where: { id } });
  },
  listByWorkspace(workspaceId: string) {
    return prisma.client.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, include: { businessProfile: true } });
  },
  create(input: { organizationId: string; workspaceId: string; name: string; email?: string; country?: string; proposedBusiness?: string; intakeData?: unknown }) {
    return prisma.client.create({ data: { ...input, intakeData: input.intakeData ?? undefined } });
  },
  update(id: string, data: { name?: string; email?: string; country?: string; proposedBusiness?: string; intakeData?: unknown }) {
    return prisma.client.update({ where: { id }, data });
  },
};
