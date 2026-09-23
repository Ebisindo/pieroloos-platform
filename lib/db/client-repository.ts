import { prisma } from './prisma';

export type CreateClientInput = {
  organizationId: string;
  workspaceId: string;
  name: string;
  email?: string;
  country?: string;
  proposedBusiness?: string;
  intakeData?: unknown;
};

export async function createClient(input: CreateClientInput) {
  return prisma.client.create({
    data: {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      name: input.name,
      email: input.email,
      country: input.country,
      proposedBusiness: input.proposedBusiness,
      intakeData: input.intakeData as object | undefined,
    },
  });
}

export async function getClientById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      businessProfile: true,
      engagements: true,
    },
  });
}

export async function listClients(organizationId: string) {
  return prisma.client.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
  });
}
