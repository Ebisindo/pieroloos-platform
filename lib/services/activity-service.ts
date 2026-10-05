import { activityRepository } from "@/lib/db/activity-repository";
import { activityCreateSchema, type ActivityCreateInput } from "@/lib/validation/engagement";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const activityService = {
  async create(input: ActivityCreateInput, principal: WorkspacePrincipal) {
    const parsed = activityCreateSchema.parse(input);
    if (!parsed.engagementId) throw new Error("ENGAGEMENT_REQUIRED");
    return activityRepository.create({
      engagementId: parsed.engagementId,
      type: parsed.type,
      title: parsed.title,
      description: parsed.description,
    }, principal);
  },
};
