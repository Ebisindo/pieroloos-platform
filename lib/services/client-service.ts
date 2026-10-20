import { clientRepository } from "@/lib/db/client-repository";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { clientIntakeSchema, type ClientIntakeInput } from "@/lib/validation/intake";

export const clientService = {
  async create(input: unknown, principal: WorkspacePrincipal) {
    const data = clientIntakeSchema.parse(input);
    return clientRepository.createFromIntake(data, principal);
  },

  get(id: string, principal: WorkspacePrincipal) {
    return clientRepository.findById(id, principal);
  },

  list(principal: WorkspacePrincipal) {
    return clientRepository.listByWorkspace(principal);
  },
};

export async function createClient(input: ClientIntakeInput, principal: WorkspacePrincipal) {
  return clientRepository.createFromIntake(clientIntakeSchema.parse(input), principal);
}
