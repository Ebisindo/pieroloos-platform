import { activityRepository } from "@/lib/db/activity-repository";
import { activityCreateSchema, type ActivityCreateInput } from "@/lib/validation/engagement";

export const activityService = {
  async create(input: ActivityCreateInput) {
    return activityRepository.create(activityCreateSchema.parse(input));
  },
};
