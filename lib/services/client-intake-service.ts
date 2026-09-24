import { clientIntakeSchema, type ClientIntakeInput } from "@/lib/validation/intake";
import { clientRepository } from "@/lib/db/client-repository";

export async function createClientFromIntake(input: ClientIntakeInput) {
  const payload = clientIntakeSchema.parse(input);
  return clientRepository.createFromIntake(payload);
}
