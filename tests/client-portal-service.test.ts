import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import type { ClientPortalPrincipal } from "@/lib/auth/client-portal-access";

const {
  clientFindFirst,
  clientFindMany,
  userFindFirst,
  userCreate,
  grantFindUnique,
  grantFindUniqueOrThrow,
  grantFindMany,
  grantCreate,
  grantUpdate,
  taskFindFirst,
  taskUpdate,
  formationTaskFindFirst,
  formationTaskUpdate,
  obligationFindFirst,
  obligationUpdate,
  auditCreate,
  documentFindMany,
  documentFindFirst,
  documentAccessEventCreate,
  interactionFindMany,
  interactionFindFirst,
  interactionCreate,
  interactionUpdate,
  transaction,
} = vi.hoisted(() => {
  const clientFindFirst = vi.fn();
  const clientFindMany = vi.fn();
  const userFindFirst = vi.fn();
  const userCreate = vi.fn();
  const grantFindUnique = vi.fn();
  const grantFindUniqueOrThrow = vi.fn();
  const grantFindMany = vi.fn();
  const grantCreate = vi.fn();
  const grantUpdate = vi.fn();
  const taskFindFirst = vi.fn();
  const taskUpdate = vi.fn();
  const formationTaskFindFirst = vi.fn();
  const formationTaskUpdate = vi.fn();
  const obligationFindFirst = vi.fn();
  const obligationUpdate = vi.fn();
  const auditCreate = vi.fn();
  const documentFindMany = vi.fn();
  const documentFindFirst = vi.fn();
  const documentAccessEventCreate = vi.fn();
  const interactionFindMany = vi.fn();
  const interactionFindFirst = vi.fn();
  const interactionCreate = vi.fn();
  const interactionUpdate = vi.fn();
  const transaction = {
    client: { findFirst: clientFindFirst, findMany: clientFindMany },
    user: { findFirst: userFindFirst, create: userCreate },
    clientPortalGrant: {
      findUnique: grantFindUnique,
      findUniqueOrThrow: grantFindUniqueOrThrow,
      findMany: grantFindMany,
      create: grantCreate,
      update: grantUpdate,
    },
    task: { findFirst: taskFindFirst, update: taskUpdate },
    formationTask: { findFirst: formationTaskFindFirst, update: formationTaskUpdate },
    complianceObligation: { findFirst: obligationFindFirst, update: obligationUpdate },
    clientPortalAuditEvent: { create: auditCreate },
    document: { findMany: documentFindMany, findFirst: documentFindFirst },
    documentAccessEvent: { create: documentAccessEventCreate },
    clientPortalInteraction: {
      findMany: interactionFindMany,
      findFirst: interactionFindFirst,
      create: interactionCreate,
      update: interactionUpdate,
    },
  };
  return {
    clientFindFirst,
    clientFindMany,
    userFindFirst,
    userCreate,
    grantFindUnique,
    grantFindUniqueOrThrow,
    grantFindMany,
    grantCreate,
    grantUpdate,
    taskFindFirst,
    taskUpdate,
    formationTaskFindFirst,
    formationTaskUpdate,
    obligationFindFirst,
    obligationUpdate,
    auditCreate,
    documentFindMany,
    documentFindFirst,
    documentAccessEventCreate,
    interactionFindMany,
    interactionFindFirst,
    interactionCreate,
    interactionUpdate,
    transaction,
  };
});

vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: vi.fn(
    async (_principal: unknown, _permission: unknown, operation: (tx: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
  ),
}));
vi.mock("@/lib/auth/client-portal-access", () => ({
  withClientPortalGrantTransaction: vi.fn(
    async (_principal: unknown, _capability: unknown, operation: (tx: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
  ),
}));
vi.mock("@/lib/storage/s3-object-storage", () => ({
  getS3ObjectStorage: () => ({ createDownloadUrl: vi.fn() }),
}));

import {
  createClientPortalGrant,
  createClientPortalInteraction,
  getClientPortalOverview,
  reviewClientPortalCompletionSubmission,
  setClientPortalTaskVisibility,
} from "@/lib/services/client-portal-service";

const workspacePrincipal: WorkspacePrincipal = {
  userId: "staff-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["client:read", "client:write"],
};
const portalPrincipal: ClientPortalPrincipal = {
  userId: "client-user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  clientId: "client-1",
  clientPortalGrantId: "grant-1",
};

describe("client portal service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientFindFirst.mockResolvedValue({ id: "client-1", email: "client@example.test" });
    clientFindMany.mockResolvedValue([]);
    userFindFirst.mockResolvedValue({ id: "client-user-1" });
    userCreate.mockResolvedValue({ id: "new-client-user" });
    grantFindUnique.mockResolvedValue(null);
    grantCreate.mockResolvedValue({ id: "grant-1" });
    grantUpdate.mockResolvedValue({ id: "grant-1" });
    taskFindFirst.mockResolvedValue({ id: "task-1" });
    taskUpdate.mockResolvedValue({});
    formationTaskFindFirst.mockResolvedValue({ id: "formation-task-1" });
    formationTaskUpdate.mockResolvedValue({});
    obligationFindFirst.mockResolvedValue({ id: "obligation-1" });
    obligationUpdate.mockResolvedValue({});
    grantFindUniqueOrThrow.mockResolvedValue({ canViewTasks: true });
    documentFindMany.mockResolvedValue([]);
    documentFindFirst.mockResolvedValue(null);
    interactionFindMany.mockResolvedValue([]);
    interactionFindFirst.mockResolvedValue(null);
    interactionCreate.mockResolvedValue({
      id: "interaction-1",
      kind: "COMPLETION_SUBMISSION",
      status: "PENDING",
      body: "Done",
      resourceType: "TASK",
      resourceId: "task-1",
      createdAt: new Date("2026-10-09T00:00:00.000Z"),
    });
    interactionUpdate.mockResolvedValue({});
    auditCreate.mockResolvedValue({});
    documentAccessEventCreate.mockResolvedValue({});
  });

  it("creates a scoped grant only for the client record's matching address and audits the grant", async () => {
    await createClientPortalGrant("client-1", " CLIENT@example.test ", workspacePrincipal);

    expect(userFindFirst).toHaveBeenCalledWith({
      where: { email: { equals: "client@example.test", mode: "insensitive" } },
      select: { id: true },
    });
    expect(grantCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        userId: "client-user-1",
        grantedByUserId: "staff-1",
      },
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "ACCESS_GRANTED", clientId: "client-1" }),
    }));
  });

  it("provisions a portal-only user for the exact client email", async () => {
    userFindFirst.mockResolvedValue(null);
    await createClientPortalGrant("client-1", "client@example.test", workspacePrincipal);
    expect(userCreate).toHaveBeenCalledWith({
      data: { email: "client@example.test" },
      select: { id: true },
    });
    expect(grantCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "new-client-user" }),
    }));
  });

  it("rejects a different email rather than granting access to an arbitrary user", async () => {
    await expect(createClientPortalGrant("client-1", "attacker@example.test", workspacePrincipal))
      .rejects.toThrow("CLIENT_PORTAL_EMAIL_MISMATCH");
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(grantCreate).not.toHaveBeenCalled();
  });

  it("publishes only client-owned resources and records every visibility change", async () => {
    await setClientPortalTaskVisibility("client-1", {
      resourceType: "FORMATION_TASK",
      resourceId: "formation-task-1",
      visible: true,
    }, workspacePrincipal);

    expect(formationTaskFindFirst).toHaveBeenCalledWith({
      where: {
        id: "formation-task-1",
        formationStage: {
          formationPlan: { clientId: "client-1", workspaceId: "workspace-1" },
        },
      },
      select: { id: true },
    });
    expect(formationTaskUpdate).toHaveBeenCalledWith({
      where: { id: "formation-task-1" },
      data: { portalVisible: true },
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "RESOURCE_PUBLISHED",
        resourceId: "formation-task-1",
        metadata: { resourceType: "FORMATION_TASK" },
      }),
    }));
  });

  it("returns no portal data for a resource that is outside the selected client", async () => {
    taskFindFirst.mockResolvedValue(null);

    await expect(setClientPortalTaskVisibility("client-1", {
      resourceType: "TASK",
      resourceId: "foreign-task",
      visible: true,
    }, workspacePrincipal)).rejects.toThrow("CLIENT_PORTAL_RESOURCE_NOT_FOUND");
    expect(taskUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("stores client completion submissions without changing task workflow state", async () => {
    interactionCreate.mockResolvedValue({
      id: "submission-1",
      kind: "COMPLETION_SUBMISSION",
      status: "PENDING",
      body: "I uploaded the requested details.",
      resourceType: "TASK",
      resourceId: "task-1",
      createdAt: new Date(),
    });

    await createClientPortalInteraction(portalPrincipal, {
      kind: "COMPLETION_SUBMISSION",
      resourceType: "TASK",
      resourceId: "task-1",
      content: "I uploaded the requested details.",
    });

    expect(taskFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "task-1", portalVisible: true }),
    }));
    expect(interactionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: "COMPLETION_SUBMISSION", status: "PENDING" }),
    }));
    expect(taskUpdate).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "CLIENT_COMPLETION_SUBMITTED" }),
    }));
  });

  it("rejects submissions on unpublished resources", async () => {
    taskFindFirst.mockResolvedValue(null);

    await expect(createClientPortalInteraction(portalPrincipal, {
      kind: "COMPLETION_SUBMISSION",
      resourceType: "TASK",
      resourceId: "hidden-task",
      content: "Done",
    })).rejects.toThrow("CLIENT_PORTAL_RESOURCE_NOT_FOUND");

    expect(interactionCreate).not.toHaveBeenCalled();
  });

  it("stores an authenticated acknowledgment and hash of the exact request text", async () => {
    const statement = "I acknowledge the formation instruction.";
    interactionFindFirst.mockResolvedValue({
      id: "request-1",
      body: statement,
      resourceType: "TASK",
      resourceId: "task-1",
    });
    interactionCreate.mockResolvedValue({
      id: "ack-1",
      kind: "ACKNOWLEDGMENT",
      status: "ACKNOWLEDGED",
      body: statement,
      contentHash: "placeholder",
      createdAt: new Date(),
    });

    await createClientPortalInteraction(portalPrincipal, {
      kind: "ACKNOWLEDGMENT",
      requestId: "request-1",
    });

    const { createHash } = await import("node:crypto");
    const expectedHash = createHash("sha256").update(statement, "utf8").digest("hex");
    expect(interactionUpdate).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: { status: "ACKNOWLEDGED" },
    });
    expect(interactionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorUserId: portalPrincipal.userId,
        parentInteractionId: "request-1",
        body: statement,
        contentHash: expectedHash,
      }),
    }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "CLIENT_ACKNOWLEDGED" }),
    }));
  });

  it("reviews a client submission without changing the underlying task", async () => {
    interactionFindFirst.mockResolvedValue({ id: "submission-1", clientId: "client-1" });
    interactionUpdate.mockResolvedValue({
      id: "submission-1",
      status: "ACCEPTED",
      reviewedAt: new Date(),
      reviewNote: null,
    });

    await reviewClientPortalCompletionSubmission(
      "client-1",
      "submission-1",
      workspacePrincipal,
      "ACCEPTED",
    );

    expect(interactionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "submission-1" },
      data: expect.objectContaining({ status: "ACCEPTED", reviewedByUserId: workspacePrincipal.userId }),
    }));
    expect(taskUpdate).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "COMPLETION_ACCEPTED" }),
    }));
  });

  it("queries only explicitly published workflow items and limits evidence to this portal user", async () => {
    clientFindFirst.mockResolvedValue({
      id: "client-1",
      name: null,
      firstName: "Casey",
      lastName: "Client",
      organizationName: null,
      engagements: [],
      formationPlans: [],
      complianceObligations: [],
    });

    const overview = await getClientPortalOverview(portalPrincipal);

    expect(clientFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "client-1",
        workspaceId: "workspace-1",
        organizationId: "org-1",
      },
      select: expect.objectContaining({
        engagements: expect.objectContaining({
          select: expect.objectContaining({
            tasks: expect.objectContaining({ where: { portalVisible: true } }),
          }),
        }),
        formationPlans: expect.objectContaining({
          select: expect.objectContaining({
            stages: expect.objectContaining({
              select: expect.objectContaining({
                tasks: expect.objectContaining({ where: { portalVisible: true } }),
              }),
            }),
          }),
        }),
        complianceObligations: expect.objectContaining({
          where: { workspaceId: "workspace-1", portalVisible: true },
        }),
      }),
    }));
    expect(documentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        clientId: "client-1",
        uploadedByUserId: "client-user-1",
      }),
    }));
    expect(overview.client.displayName).toBe("Casey Client");
    expect(overview.nextActions).toEqual([]);
  });
});
