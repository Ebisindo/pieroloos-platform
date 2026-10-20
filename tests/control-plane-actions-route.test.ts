import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { GET, POST } from "@/app/api/control-plane/actions/route";
import { POST as transitionPost } from "@/app/api/control-plane/actions/[id]/transition/route";
import { POST as resolvePost } from "@/app/api/control-plane/actions/[id]/resolve/route";

const {
  getWorkspaceContextMock,
  listActiveOperationalActionsMock,
  createActionFromTrustedSignalMock,
  operationalActionFindUniqueMock,
  operationalActionUpdateMock,
  operationalActionAuditCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  listActiveOperationalActionsMock: vi.fn(),
  createActionFromTrustedSignalMock: vi.fn(),
  operationalActionFindUniqueMock: vi.fn(),
  operationalActionUpdateMock: vi.fn(),
  operationalActionAuditCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback) => callback({
      membership: { findUnique: vi.fn().mockResolvedValue({ role: "OWNER" }) },
      workspace: { findFirst: vi.fn().mockResolvedValue({ id: "workspace-1" }) },
      operationalAction: {
        findUnique: operationalActionFindUniqueMock,
        findFirst: operationalActionFindUniqueMock,
        update: operationalActionUpdateMock,
      },
      operationalActionAuditEvent: {
        create: operationalActionAuditCreateMock,
      },
    })),
    operationalAction: {
      findUnique: operationalActionFindUniqueMock,
      findFirst: operationalActionFindUniqueMock,
      update: operationalActionUpdateMock,
    },
    operationalActionAuditEvent: {
      create: operationalActionAuditCreateMock,
    },
  },
}));
vi.mock("@/lib/db/operational-action-query", () => ({
  listActiveOperationalActions: listActiveOperationalActionsMock,
  mapOperationalAction: (record: any) => ({
    id: record.id,
    organizationId: record.organizationId,
    workspaceId: record.workspaceId,
    title: record.title,
    description: record.description ?? undefined,
    sourceSignalId: record.sourceSignalId ?? undefined,
    clientId: record.clientId ?? undefined,
    engagementId: record.engagementId ?? undefined,
    documentId: record.documentId ?? undefined,
    complianceObligationId: record.complianceObligationId ?? undefined,
    assigneeUserId: record.assigneeUserId ?? undefined,
    createdByUserId: record.createdByUserId,
    priority: record.priority,
    status: record.status,
    dueAt: record.dueAt ?? undefined,
    escalationLevel: record.escalationLevel,
    escalationAt: record.escalationAt ?? undefined,
    resolvedAt: record.resolvedAt ?? undefined,
    resolutionNote: record.resolutionNote ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }),
}));
vi.mock("@/lib/services/trusted-action-service", () => ({
  createActionFromTrustedSignal: createActionFromTrustedSignalMock,
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:read"],
};

describe("control-plane actions GET", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset();
    listActiveOperationalActionsMock.mockReset();
    createActionFromTrustedSignalMock.mockReset();
    operationalActionFindUniqueMock.mockReset();
    operationalActionUpdateMock.mockReset();
    operationalActionAuditCreateMock.mockReset();
  });

  it("updates a workspace-scoped action with optimistic locking", async () => {
    const action = {
      id: "action-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      title: "Replace rejected evidence",
      description: "Need a new document.",
      sourceSignalId: "evidence-gap:obligation-1",
      clientId: "client-1",
      createdByUserId: "user-1",
      priority: "HIGH",
      status: "OPEN",
      dueAt: null,
      escalationLevel: 0,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      assigneeUserId: null,
      engagementId: null,
      documentId: null,
      complianceObligationId: "obligation-1",
      resolvedAt: null,
      resolutionNote: null,
    };
    const prismaMock: any = (await import("@/lib/db/prisma")).prisma;
    prismaMock.operationalAction.findUnique.mockResolvedValue(action);
    prismaMock.operationalAction.update.mockResolvedValue({ ...action, status: "IN_PROGRESS", updatedAt: new Date("2024-01-01T00:05:00.000Z") });
    prismaMock.operationalActionAuditEvent.create.mockResolvedValue({ id: "audit-1" });
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: [...principal.permissions, "compliance:write"] },
    });

    const response = await transitionPost(
      new Request("http://localhost/api/control-plane/actions/action-1/transition", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ status: "IN_PROGRESS", expectedUpdatedAt: "2024-01-01T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "action-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ data: expect.objectContaining({ status: "IN_PROGRESS" }) }));
    expect(prismaMock.operationalAction.update).toHaveBeenCalled();
  });

  it("requires the dedicated assignment command to assign an action", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: [...principal.permissions, "compliance:write"] },
    });

    const response = await transitionPost(
      new Request("http://localhost/api/control-plane/actions/action-1/transition", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ status: "ASSIGNED", expectedUpdatedAt: "2024-01-01T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "action-1" }) },
    );

    expect(response.status).toBe(422);
    expect(operationalActionFindUniqueMock).not.toHaveBeenCalled();
    expect(operationalActionUpdateMock).not.toHaveBeenCalled();
  });

  it("requires the resolution endpoint and note to resolve an action", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: [...principal.permissions, "compliance:write"] },
    });

    const response = await transitionPost(
      new Request("http://localhost/api/control-plane/actions/action-1/transition", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ status: "RESOLVED", expectedUpdatedAt: "2024-01-01T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "action-1" }) },
    );

    expect(response.status).toBe(422);
    expect(operationalActionFindUniqueMock).not.toHaveBeenCalled();
    expect(operationalActionUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects stale transitions with a concurrency conflict", async () => {
    const action = {
      id: "action-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      title: "Replace rejected evidence",
      description: "Need a new document.",
      sourceSignalId: "evidence-gap:obligation-1",
      clientId: "client-1",
      createdByUserId: "user-1",
      priority: "HIGH",
      status: "OPEN",
      dueAt: null,
      escalationLevel: 0,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      assigneeUserId: null,
      engagementId: null,
      documentId: null,
      complianceObligationId: "obligation-1",
      resolvedAt: null,
      resolutionNote: null,
    };
    const prismaMock: any = (await import("@/lib/db/prisma")).prisma;
    prismaMock.operationalAction.findUnique.mockResolvedValue(action);
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: [...principal.permissions, "compliance:write"] },
    });

    const response = await transitionPost(
      new Request("http://localhost/api/control-plane/actions/action-1/transition", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ status: "IN_PROGRESS", expectedUpdatedAt: "2024-01-01T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "action-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Action changed since it was loaded. Refresh before retrying." });
  });

  it("resolves an action and records the durable resolution audit entry", async () => {
    const action = {
      id: "action-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      title: "Replace rejected evidence",
      description: "Need a new document.",
      sourceSignalId: "evidence-gap:obligation-1",
      clientId: "client-1",
      createdByUserId: "user-1",
      priority: "HIGH",
      status: "IN_PROGRESS",
      dueAt: null,
      escalationLevel: 0,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      assigneeUserId: null,
      engagementId: null,
      documentId: null,
      complianceObligationId: "obligation-1",
      resolvedAt: null,
      resolutionNote: null,
    };
    const prismaMock: any = (await import("@/lib/db/prisma")).prisma;
    prismaMock.operationalAction.findUnique.mockResolvedValue(action);
    prismaMock.operationalAction.update.mockResolvedValue({ ...action, status: "RESOLVED", updatedAt: new Date("2024-01-01T00:05:00.000Z"), resolutionNote: "Evidence replaced.", resolvedAt: new Date("2024-01-01T00:05:00.000Z") });
    prismaMock.operationalActionAuditEvent.create.mockResolvedValue({ id: "audit-1" });
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: [...principal.permissions, "compliance:write"] },
    });

    const response = await resolvePost(
      new Request("http://localhost/api/control-plane/actions/action-1/resolve", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ resolutionNote: "Evidence replaced.", expectedUpdatedAt: "2024-01-01T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "action-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED" }) }));
    expect(prismaMock.operationalActionAuditEvent.create).toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: null, principal: null });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listActiveOperationalActionsMock).not.toHaveBeenCalled();
  });

  it("requires a selected workspace", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: "user-1", principal: null });

    const response = await GET();

    expect(response.status).toBe(409);
    expect(listActiveOperationalActionsMock).not.toHaveBeenCalled();
  });

  it("requires compliance-read permission", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: "user-1",
      principal: { ...principal, permissions: ["workspace:read"] },
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(listActiveOperationalActionsMock).not.toHaveBeenCalled();
  });

  it("returns actions from the active workspace", async () => {
    const actions = [{ id: "action-1" }];
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal });
    listActiveOperationalActionsMock.mockResolvedValue(actions);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: actions });
    expect(listActiveOperationalActionsMock).toHaveBeenCalledWith(principal);
  });

  it("requires compliance-write permission to create actions", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: "user-1",
      principal: { ...principal, permissions: ["compliance:read"] },
    });
    const request = new Request("http://localhost/api/control-plane/actions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ signalId: "evidence-gap:obligation-1" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(createActionFromTrustedSignalMock).not.toHaveBeenCalled();
  });

  it("rejects signal IDs outside the trusted evidence-gap format", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal: {
      ...principal,
      permissions: [...principal.permissions, "compliance:write"],
    } });
    const request = new Request("http://localhost/api/control-plane/actions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ signalId: "client-invented-signal" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
    expect(createActionFromTrustedSignalMock).not.toHaveBeenCalled();
  });

  it("creates a trusted action and returns the persisted action", async () => {
    const action = { id: "action-1" };
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal: {
      ...principal,
      permissions: [...principal.permissions, "compliance:write"],
    } });
    createActionFromTrustedSignalMock.mockResolvedValue({ action, created: true });
    const request = new Request("http://localhost/api/control-plane/actions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ signalId: "evidence-gap:obligation-1" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: action });
    expect(createActionFromTrustedSignalMock).toHaveBeenCalledWith("evidence-gap:obligation-1", expect.objectContaining({
      workspaceId: principal.workspaceId,
    }));
  });

  it("returns 200 when the action already exists for the trusted signal", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal: {
      ...principal,
      permissions: [...principal.permissions, "compliance:write"],
    } });
    createActionFromTrustedSignalMock.mockResolvedValue({ action: { id: "action-1" }, created: false });
    const request = new Request("http://localhost/api/control-plane/actions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ signalId: "evidence-gap:obligation-1" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});