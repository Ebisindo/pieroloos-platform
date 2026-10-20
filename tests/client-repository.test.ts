import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientRepository } from "@/lib/db/client-repository";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { clientIntakeSchema } from "@/lib/validation/intake";

const { transactionMock, membershipFindUniqueMock, workspaceFindFirstMock, clientCreateMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
  workspaceFindFirstMock: vi.fn(),
  clientCreateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: transactionMock },
}));

describe("client repository authorization", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    membershipFindUniqueMock.mockReset();
    workspaceFindFirstMock.mockReset();
    clientCreateMock.mockReset();
  });

  it("rejects client creation without formation-write permission before opening a transaction", async () => {
    const input = clientIntakeSchema.parse({
      client: { legalName: "Example Founder" },
      business: { objective: "Establish and operate an international business." },
    });
    const principal: WorkspacePrincipal = {
      userId: "user-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      role: "owner",
      permissions: ["workspace:read"],
    };

    await expect(clientRepository.createFromIntake(input, principal)).rejects.toThrow(
      "Forbidden: formation:write",
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("creates the client in the principal's organization and workspace", async () => {
    transactionMock.mockImplementation((callback) => {
      membershipFindUniqueMock.mockResolvedValue({ role: "OWNER" });
      workspaceFindFirstMock.mockResolvedValue({ id: "workspace-2", organizationId: "org-2" });
      return callback({
        membership: { findUnique: membershipFindUniqueMock },
        workspace: { findFirst: workspaceFindFirstMock },
        client: { create: clientCreateMock },
      });
    });
    workspaceFindFirstMock.mockResolvedValue({ id: "workspace-2", organizationId: "org-2" });
    clientCreateMock.mockResolvedValue({ id: "client-1" });

    const input = clientIntakeSchema.parse({
      client: { legalName: "Example Founder" },
      business: { objective: "Establish and operate an international business." },
    });
    const principal: WorkspacePrincipal = {
      userId: "user-1",
      organizationId: "org-2",
      workspaceId: "workspace-2",
      role: "owner",
      permissions: ["formation:write"],
    };

    await clientRepository.createFromIntake(input, principal);

    expect(workspaceFindFirstMock).toHaveBeenCalledWith({
      where: { id: "workspace-2", organizationId: "org-2" },
      select: { id: true, organizationId: true },
    });
    expect(clientCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-2", workspaceId: "workspace-2" }),
    }));
  });
});
