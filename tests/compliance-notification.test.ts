import { describe, expect, it, vi } from "vitest";
import type { OperationalAction } from "@/lib/domain/action-control";
import { queueComplianceNotification } from "@/lib/services/compliance-notification";
import { EscalationService } from "@/lib/services/escalation-service";

const baseAction: OperationalAction = {
  id: "action-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  title: "Submit missing evidence",
  description: "The client did not upload the required evidence packet.",
  sourceSignalId: "evidence-gap:obligation-1",
  clientId: "client-1",
  complianceObligationId: "obligation-1",
  createdByUserId: "user-1",
  assigneeUserId: "user-2",
  priority: "CRITICAL",
  status: "OPEN",
  dueAt: new Date("2026-10-01T00:00:00Z"),
  escalationLevel: 0,
  escalationAt: undefined,
  resolvedAt: undefined,
  resolutionNote: undefined,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

describe("compliance notification worker", () => {
  it("deduplicates repeated notifications using the supplied idempotency key", async () => {
    const dispatcher = {
      enqueue: vi.fn(),
      findByDedupeKey: vi.fn().mockResolvedValue({
        id: "notification-42",
        obligationId: "obligation-1",
        recipientUserId: "user-2",
        channel: "IN_APP",
        subject: "Action escalated",
        body: "Escalation continued.",
        scheduledFor: new Date("2026-10-02T00:00:00Z"),
        status: "QUEUED",
        dedupeKey: "escalation:action-1:1",
      }),
    };

    const result = await queueComplianceNotification(dispatcher, {
      organizationId: "org-1",
      workspaceId: "workspace-1",
      obligationId: "obligation-1",
      recipientUserId: "user-2",
      channel: "IN_APP",
      subject: "Action escalated",
      body: "Escalation continued.",
      scheduledFor: new Date("2026-10-02T00:00:00Z"),
      dedupeKey: "escalation:action-1:1",
    });

    expect(dispatcher.enqueue).not.toHaveBeenCalled();
    expect(result.id).toBe("notification-42");
    expect(result.dedupeKey).toBe("escalation:action-1:1");
  });

  it("queues an escalation notification after a level increase", async () => {
    const repository = {
      findDueActions: vi.fn().mockResolvedValue([baseAction]),
      commitEscalation: vi.fn().mockResolvedValue(true),
    };

    const service = new EscalationService(repository);

    const escalated = await service.evaluateWorkspace({
      organizationId: "org-1",
      workspaceId: "workspace-1",
      now: new Date("2026-10-02T00:00:00Z"),
    });

    expect(escalated).toHaveLength(1);
    expect(repository.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({
      action: baseAction,
      event: expect.objectContaining({ fromLevel: 0, toLevel: 1 }),
      notification: expect.objectContaining({
        obligationId: "obligation-1",
        recipientUserId: "user-2",
        subject: "Action escalated to level 1",
        dedupeKey: "escalation:action-1:1",
      }),
    }));
  });
});
