import type { OperationalAction } from "@/lib/domain/action-control";
import { assessEscalation, DEFAULT_ESCALATION_POLICIES } from "@/lib/domain/escalation-engine";
import {
  buildEscalationNotification,
  type ComplianceNotification,
} from "@/lib/services/compliance-notification";

export type EscalationEvent = {
  actionId: string;
  fromLevel: number;
  toLevel: number;
  reason: string;
  occurredAt: Date;
};

export type EscalationCommit = {
  action: OperationalAction;
  event: EscalationEvent;
  notification: Omit<ComplianceNotification, "id" | "status"> & {
    id?: string;
    status?: ComplianceNotification["status"];
  };
};

export interface EscalationRepository {
  findDueActions(input: {
    now: Date;
    organizationId?: string;
    workspaceId?: string;
  }): Promise<OperationalAction[]>;
  commitEscalation(input: EscalationCommit): Promise<boolean>;
}

export class EscalationService {
  constructor(private readonly repository: EscalationRepository) {}

  async evaluateWorkspace(input: {
    organizationId: string;
    workspaceId: string;
    now?: Date;
  }): Promise<EscalationEvent[]> {
    const result = await this.evaluateDueActions(input);
    return result.escalated;
  }

  async evaluateDueActions(input: {
    organizationId?: string;
    workspaceId?: string;
    now?: Date;
  } = {}) {
    const now = input.now ?? new Date();
    const actions = await this.repository.findDueActions({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      now,
    });
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
      const notification = buildEscalationNotification(action, assessment.nextLevel, now);
      const committed = await this.repository.commitEscalation({ action, event, notification });
      if (committed) escalated.push(event);
    }

    return { evaluated: actions.length, escalated };
  }
}
