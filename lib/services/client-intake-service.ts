import { clientIntakeSchema, type ClientIntakeInput } from "@/lib/validation/intake";
import { clientRepository } from "@/lib/db/client-repository";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

export async function createClientFromIntake(input: ClientIntakeInput, principal: WorkspacePrincipal) {
  const payload = clientIntakeSchema.parse(input);
  return clientRepository.createFromIntake(payload, principal);
}
