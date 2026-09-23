import { createClient, getClientById, listClients } from '@/lib/db/client-repository';
import { clientIntakeSchema } from '@/lib/validation/client';

export async function createClientFromIntake(input: unknown) {
  const data = clientIntakeSchema.parse(input);

  return createClient({
    organizationId: data.organizationId,
    workspaceId: data.workspaceId,
    name: data.name,
    email: data.email,
    country: data.country,
    proposedBusiness: data.proposedBusiness,
    intakeData: data.intakeData,
  });
}

export { getClientById, listClients };
