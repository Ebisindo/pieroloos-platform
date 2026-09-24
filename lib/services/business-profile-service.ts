import {
  businessProfileUpdateSchema,
  type BusinessProfileUpdateInput,
} from "@/lib/validation/business-profile";
import { businessProfileRepository } from "@/lib/db/business-profile-repository";

export const businessProfileService = {
  async update(id: string, input: BusinessProfileUpdateInput) {
    const payload = businessProfileUpdateSchema.parse(input);
    return businessProfileRepository.update(id, payload);
  },
};

export async function updateBusinessProfile(
  id: string,
  input: BusinessProfileUpdateInput,
) {
  return businessProfileService.update(id, input);
}
