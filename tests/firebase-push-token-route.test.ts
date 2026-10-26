import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  workspaceContextMock,
  tokenFindUniqueMock,
  tokenCountMock,
  transactionMock,
  tokenUpsertMock,
  tokenUpdateManyMock,
  preferenceUpsertMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  workspaceContextMock: vi.fn(),
  tokenFindUniqueMock: vi.fn(),
  tokenCountMock: vi.fn(),
  transactionMock: vi.fn(),
  tokenUpsertMock: vi.fn(),
  tokenUpdateManyMock: vi.fn(),
  preferenceUpsertMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: authMock }));
vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: workspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    firebasePushToken: {
      findUnique: tokenFindUniqueMock,
      count: tokenCountMock,
      upsert: tokenUpsertMock,
      updateMany: tokenUpdateManyMock,
    },
    notificationPreference: {
      upsert: preferenceUpsertMock,
      updateMany: vi.fn(),
    },
    $transaction: transactionMock,
  },
}));

import { POST } from "@/app/api/notifications/push-token/route";

const token = "f".repeat(160);

describe("Firebase push token route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    workspaceContextMock.mockResolvedValue({
      principal: { userId: "user-1", workspaceId: "workspace-1", organizationId: "org-1" },
    });
    tokenFindUniqueMock.mockResolvedValue(null);
    tokenCountMock.mockResolvedValue(0);
    transactionMock.mockImplementation(async (operation: unknown) => {
      if (typeof operation === "function") {
        return operation({
          firebasePushToken: { upsert: tokenUpsertMock, updateMany: tokenUpdateManyMock },
          notificationPreference: { upsert: preferenceUpsertMock },
        });
      }
      return Promise.all(operation as Promise<unknown>[]);
    });
    tokenUpsertMock.mockResolvedValue({ id: "token-1" });
    preferenceUpsertMock.mockResolvedValue({});
  });

  it("rejects cross-origin requests before reading the session or mutating storage", async () => {
    const response = await POST(new Request("https://app.example/api/notifications/push-token", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }));
    expect(response.status).toBe(403);
    expect(authMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated token registration without database writes", async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(new Request("https://app.example/api/notifications/push-token", {
      method: "POST",
      headers: { origin: "https://app.example", "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }));
    expect(response.status).toBe(401);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("does not transfer a token already owned by another user", async () => {
    tokenFindUniqueMock.mockResolvedValue({ userId: "user-2" });
    const response = await POST(new Request("https://app.example/api/notifications/push-token", {
      method: "POST",
      headers: { origin: "https://app.example", "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }));
    expect(response.status).toBe(409);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(tokenUpsertMock).not.toHaveBeenCalled();
  });

  it("caps active browser registrations for a user", async () => {
    tokenCountMock.mockResolvedValue(10);
    const response = await POST(new Request("https://app.example/api/notifications/push-token", {
      method: "POST",
      headers: { origin: "https://app.example", "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }));
    expect(response.status).toBe(429);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects malformed tokens without writes", async () => {
    const response = await POST(new Request("https://app.example/api/notifications/push-token", {
      method: "POST",
      headers: { origin: "https://app.example", "content-type": "application/json" },
      body: JSON.stringify({ token: "short" }),
    }));
    expect(response.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
