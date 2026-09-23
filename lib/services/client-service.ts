import { clientRepository } from "../db/client-repository";
import { clientIntakeSchema } from "../validation/client";

export const clientService = {
  async create(input: unknown) {
    const data = clientIntakeSchema.parse(input);
    return clientRepository.create({ organizationId: data.organizationId, workspaceId: data.workspaceId, name: data.founderName, email: data.email, country: data.country, proposedBusiness: data.proposedBusiness, intakeData: data });
  },
  get(id: string) {
    return clientRepository.findById(id);
  },
  list(workspaceId: string) {
    return clientRepository.listByWorkspace(workspaceId);
  },
};
