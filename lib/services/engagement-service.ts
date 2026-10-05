import { engagementRepository } from "@/lib/db/engagement-repository";
import {
  engagementCreateSchema, engagementTransitionSchema, engagementUpdateSchema,
  type EngagementCreateInput, type EngagementTransitionInput, type EngagementUpdateInput,
} from "@/lib/validation/engagement";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const engagementService = {
  async create(input: EngagementCreateInput, principal: WorkspacePrincipal) {
    return engagementRepository.create(engagementCreateSchema.parse(input), principal);
  },

  async update(id: string, input: EngagementUpdateInput, principal: WorkspacePrincipal) {
    const payload = engagementUpdateSchema.parse(input);
    return engagementRepository.update(id, payload, principal);
  },

  async transition(id: string, input: EngagementTransitionInput, principal: WorkspacePrincipal) {
    const payload = engagementTransitionSchema.parse(input);
    return engagementRepository.transition(id, payload.toStatus, payload.note, principal);
  },
};
