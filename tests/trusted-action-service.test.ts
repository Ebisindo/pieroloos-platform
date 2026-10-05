import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { createActionFromTrustedSignal } from "@/lib/services/trusted-action-service";

const {
  transactionMock,
  obligationFindFirstMock,
  actionFindFirstMock,
  actionCreateMock,
  auditCreateMock,
  outsideActionFindFirstMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  obligationFindFirstMock: vi.fn(),
  actionFindFirstMock: vi.fn(),
  actionCreateMock: vi.fn(),
  auditCreateMock: vi.fn(),
  outsideActionFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    operationalAction: { findFirst: outsideActionFindFirstMock },
  },
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  permissions: ["compliance:write"],
};

const existingAction = {
  id: "action-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  title: "Evidence gap detected",
  description: "Missing filing evidence.",
  sourceSignalId: "evidence-gap:obligation-1",
  clientId: "client-1",
  engagementId: null,
  documentId: null,
  complianceObligationId: "obligation-1",
  assigneeUserId: null,
  createdByUserId: "user-1",
  priority: "CRITICAL",
  status: "OPEN",
  dueAt: null,
  escalationLevel: 0,
  escalationAt: null,
  resolvedAt: null,
  resolutionNote: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

describe("trusted signal action creation", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    obligationFindFirstMock.mockReset();
    actionFindFirstMock.mockReset();
    actionCreateMock.mockReset();
    auditCreateMock.mockReset();
    outsideActionFindFirstMock.mockReset();
    transactionMock.mockImplementation((callback) => callback({
      complianceObligation: { findFirst: obligationFindFirstMock },
      operationalAction: { findFirst: actionFindFirstMock, create: actionCreateMock },
      operationalActionAuditEvent: { create: auditCreateMock },
    }));
  });

  it("creates an action and its audit event in one workspace-scoped transaction", async () => {
    obligationFindFirstMock.mockResolvedValue({
      id: "obligation-1",
      title: "Annual filing",
      description: "Missing filing evidence.",
      clientId: "client-1",
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });
    actionCreateMock.mockImplementation(({ data }) => ({ ...existingAction, ...data }));

    const result = await createActionFromTrustedSignal("evidence-gap:obligation-1", principal);

    expect(result.created).toBe(true);
    expect(obligationFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "obligation-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        requiresEvidence: true,
        evidence: { none: {} },
      }),
    }));
    expect(actionCreateMock).toHaveBeenCalledOnce();
    const createdActionId = actionCreateMock.mock.calls[0][0].data.id;
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actionId: createdActionId,
        actorUserId: "user-1",
        eventType: "CREATED_FROM_SIGNAL",
      }),
    }));
  });

  it("returns an existing action without writing a duplicate audit event", async () => {
    actionFindFirstMock.mockResolvedValue(existingAction);

    const result = await createActionFromTrustedSignal("evidence-gap:obligation-1", principal);

    expect(result.created).toBe(false);
    expect(result.action.id).toBe("action-1");
    expect(obligationFindFirstMock).not.toHaveBeenCalled();
    expect(actionCreateMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("rejects signal IDs that cannot be re-derived from a scoped obligation", async () => {
    obligationFindFirstMock.mockResolvedValue(null);

    await expect(createActionFromTrustedSignal("evidence-gap:other-tenant-obligation", principal))
      .rejects.toThrow("TRUSTED_SIGNAL_NOT_FOUND");
    expect(actionCreateMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("recovers a concurrent duplicate insert by returning the existing action", async () => {
    obligationFindFirstMock.mockResolvedValue({
      id: "obligation-1",
      title: "Annual filing",
      description: null,
      clientId: "client-1",
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });
    actionCreateMock.mockRejectedValue({ code: "P2002" });
    outsideActionFindFirstMock.mockResolvedValue(existingAction);

    const result = await createActionFromTrustedSignal("evidence-gap:obligation-1", principal);

    expect(result.created).toBe(false);
    expect(result.action.id).toBe("action-1");
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("requires compliance-write permission before opening a transaction", async () => {
    await expect(createActionFromTrustedSignal("evidence-gap:obligation-1", {
      ...principal,
      permissions: ["compliance:read"],
    })).rejects.toThrow("Forbidden: compliance:write");

    expect(transactionMock).not.toHaveBeenCalled();
  });
});