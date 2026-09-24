import { engagementRepository } from "@/lib/db/engagement-repository";
import { activityRepository } from "@/lib/db/activity-repository";
import { assertTransition, type EngagementStatus } from "@/lib/domain/engagement";
import {
  engagementCreateSchema, engagementTransitionSchema, engagementUpdateSchema,
  type EngagementCreateInput, type EngagementTransitionInput, type EngagementUpdateInput,
} from "@/lib/validation/engagement";

export const engagementService = {
  async create(input: EngagementCreateInput) {
    return engagementRepository.create(engagementCreateSchema.parse(input));
  },

  async update(id: string, input: EngagementUpdateInput) {
    const payload = engagementUpdateSchema.parse(input);
    const current = await engagementRepository.findById(id);
    if (!current) throw new Error("Engagement not found.");

    const updated = await engagementRepository.update(id, payload);
    await activityRepository.create({
      engagementId: id,
      type: "UPDATED",
      title: "Engagement updated",
      description: "Operational engagement details were updated.",
    });
    return updated;
  },

  async transition(id: string, input: EngagementTransitionInput) {
    const payload = engagementTransitionSchema.parse(input);
    const current = await engagementRepository.findById(id);
    if (!current) throw new Error("Engagement not found.");

    assertTransition(
      current.status as EngagementStatus,
      payload.toStatus as EngagementStatus,
    );

    const updated = await engagementRepository.update(id, { status: payload.toStatus });
    await activityRepository.create({
      engagementId: id,
      type: "STATUS_CHANGED",
      title: `Status changed to ${payload.toStatus}`,
      description: payload.note,
    });
    return updated;
  },
};
