import type { ActionRepository } from "@/lib/repositories/action-repository";
import { actionFromSignal } from "@/lib/domain/action-factory";
import { resolveAction, transitionAction, type ControlActionStatus } from "@/lib/domain/action-control";
import type { OperationalSignal } from "@/lib/domain/operational-intelligence";
import { assessEscalation } from "@/lib/domain/escalation-engine";

export class ControlPlaneService {
  constructor(private readonly actions: ActionRepository) {}

  async createFromSignal(input: {
    signal: OperationalSignal;
    organizationId: string;
    workspaceId: string;
    createdByUserId: string;
    dueAt?: Date;
  }) {
    const existing = await this.actions.findMany({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      sourceSignalId: input.signal.id,
    });

    const active = existing.find(a => !["RESOLVED", "CANCELLED"].includes(a.status));
    if (active) return active;

    return this.actions.create(actionFromSignal(input));
  }

  async transition(input: {
    actionId: string;
    status: ControlActionStatus;
    expectedUpdatedAt: Date;
  }) {
    const action = await this.requireAction(input.actionId);
    if (action.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new Error("Action changed since it was loaded. Refresh before retrying.");
    }
    return this.actions.update(transitionAction(action, input.status));
  }

  async resolve(input: {
    actionId: string;
    resolutionNote: string;
    expectedUpdatedAt: Date;
  }) {
    const action = await this.requireAction(input.actionId);
    if (action.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new Error("Action changed since it was loaded. Refresh before retrying.");
    }
    return this.actions.update(resolveAction(action, input.resolutionNote));
  }

  async assess(actionId: string, now = new Date()) {
    return assessEscalation(await this.requireAction(actionId), now);
  }

  private async requireAction(id: string) {
    const action = await this.actions.findById(id);
    if (!action) throw new Error("Operational action not found.");
    return action;
  }
}
