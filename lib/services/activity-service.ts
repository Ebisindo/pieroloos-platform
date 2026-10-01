import { activityRepository } from "@/lib/db/activity-repository";
import { activityCreateSchema, type ActivityCreateInput } from "@/lib/validation/engagement";

export const activityService = {
  async create(input: ActivityCreateInput & { workspaceId?: string }) {
    const parsed = activityCreateSchema.parse(input);
    return activityRepository.create({
      ...parsed,
      workspaceId: parsed.workspaceId ?? "workspace-placeholder",
    });
  },
};
