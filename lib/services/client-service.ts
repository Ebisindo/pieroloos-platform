import { clientRepository } from "@/lib/db/client-repository";
import { clientIntakeSchema, type ClientIntakeInput } from "@/lib/validation/intake";

export const clientService = {
  async create(input: unknown) {
    const data = clientIntakeSchema.parse(input);
    return clientRepository.createFromIntake(data);
  },

  get(id: string) {
    return clientRepository.findById(id);
  },

  list(workspaceId: string) {
    return clientRepository.listByWorkspace(workspaceId);
  },
};

export async function createClient(input: ClientIntakeInput) {
  return clientRepository.createFromIntake(clientIntakeSchema.parse(input));
}
