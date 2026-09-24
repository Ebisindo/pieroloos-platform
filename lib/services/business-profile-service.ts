import { businessProfileUpdateSchema, type BusinessProfileUpdateInput } from "@/lib/validation/business-profile";
import { businessProfileRepository } from "@/lib/db/business-profile-repository";

export async function updateBusinessProfile(id: string, input: BusinessProfileUpdateInput) {
  const payload = businessProfileUpdateSchema.parse(input);
  return businessProfileRepository.update(id, payload);
}
