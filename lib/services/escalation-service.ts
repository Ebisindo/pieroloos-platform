import type { ActionRepository } from "@/lib/repositories/action-repository";
import { assessEscalation, DEFAULT_ESCALATION_POLICIES } from "@/lib/domain/escalation-engine";

export type EscalationEvent = {
  actionId: string;
  fromLevel: number;
  toLevel: number;
  reason: string;
  occurredAt: Date;
};

export interface EscalationEventRepository {
  append(event: EscalationEvent): Promise<void>;
}

export class EscalationService {
  constructor(
    private readonly actions: ActionRepository,
    private readonly events: EscalationEventRepository,
  ) {}

  async evaluateWorkspace(input: { organizationId: string; workspaceId: string; now?: Date }) {
    const now = input.now ?? new Date();
    const actions = await this.actions.findMany(input);
    const escalated: EscalationEvent[] = [];

    for (const action of actions) {
      const assessment = assessEscalation(action, now, DEFAULT_ESCALATION_POLICIES);
      if (!assessment.shouldEscalate) continue;

      const event: EscalationEvent = {
        actionId: action.id,
        fromLevel: action.escalationLevel,
        toLevel: assessment.nextLevel,
        reason: assessment.reason ?? "Escalation threshold reached.",
        occurredAt: now,
      };

      await this.actions.update({
        ...action,
        escalationLevel: assessment.nextLevel,
        escalationAt: now,
        updatedAt: now,
      });

      await this.events.append(event);
      escalated.push(event);
    }

    return escalated;
  }
}
