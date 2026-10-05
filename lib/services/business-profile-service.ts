import {
  businessProfileUpdateSchema,
  type BusinessProfileUpdateInput,
} from "@/lib/validation/business-profile";
import { businessProfileRepository } from "@/lib/db/business-profile-repository";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const businessProfileService = {
  async update(id: string, input: BusinessProfileUpdateInput, principal: WorkspacePrincipal) {
    const payload = businessProfileUpdateSchema.parse(input);
    return businessProfileRepository.update(id, payload, principal);
  },
};

export async function updateBusinessProfile(
  id: string,
  input: BusinessProfileUpdateInput,
  principal: WorkspacePrincipal,
) {
  return businessProfileService.update(id, input, principal);
}
