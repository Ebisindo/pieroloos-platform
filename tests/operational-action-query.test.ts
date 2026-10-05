import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { listActiveOperationalActions } from "@/lib/db/operational-action-query";

const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { operationalAction: { findMany: findManyMock } },
}));

describe("operational action query", () => {
  beforeEach(() => findManyMock.mockReset());

  it("limits active action reads to the principal's organization and workspace", async () => {
    const createdAt = new Date("2026-10-01T00:00:00Z");
    findManyMock.mockResolvedValue([{
      id: "action-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      title: "Review evidence",
      description: null,
      sourceSignalId: null,
      clientId: null,
      engagementId: null,
      documentId: null,
      complianceObligationId: null,
      assigneeUserId: null,
      createdByUserId: "user-1",
      priority: "HIGH",
      status: "OPEN",
      dueAt: null,
      escalationLevel: 0,
      escalationAt: null,
      resolvedAt: null,
      resolutionNote: null,
      createdAt,
      updatedAt: createdAt,
    }]);
    const principal: WorkspacePrincipal = {
      userId: "user-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      permissions: ["compliance:read"],
    };

    const actions = await listActiveOperationalActions(principal);

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: "org-1",
        workspaceId: "workspace-1",
        status: { notIn: ["RESOLVED", "CANCELLED"] },
      },
      take: 8,
    }));
    expect(actions[0].dueAt).toBeUndefined();
    expect(actions[0].priority).toBe("HIGH");
  });

  it("rejects principals without compliance-read permission before querying", async () => {
    const principal: WorkspacePrincipal = {
      userId: "user-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      permissions: ["workspace:read"],
    };

    await expect(listActiveOperationalActions(principal)).rejects.toThrow("Forbidden: compliance:read");
    expect(findManyMock).not.toHaveBeenCalled();
  });
});