import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContinuityCaseStatus, SuccessorStatus } from "@prisma/client";

const { prismaMock, tx } = vi.hoisted(() => {
  const tx = {
    membership: { findFirst: vi.fn() },
    successor: { updateMany: vi.fn() },
    businessContinuityCase: { create: vi.fn(), updateMany: vi.fn() },
    platformAuditEvent: { create: vi.fn() },
    complianceNotification: { create: vi.fn() },
    continuityAsset: { findMany: vi.fn() },
    continuityRunbook: { findMany: vi.fn() },
    continuityTransmissionPackage: { upsert: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(), successor: { findMany: vi.fn() } };
  return { prismaMock: prisma, tx };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { runSuccessorContinuityWorker } from "@/lib/services/successor-continuity-worker";

describe("successor continuity worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (arg: typeof tx) => Promise<unknown>) => callback(tx));
    prismaMock.successor.findMany.mockResolvedValue([]);
    tx.membership.findFirst.mockResolvedValue({
      organizationId: "org-1",
      organization: { workspaces: [{ id: "workspace-1" }] },
    });
    tx.successor.updateMany.mockResolvedValue({ count: 1 });
    tx.businessContinuityCase.create.mockResolvedValue({ id: "case-1" });
    tx.businessContinuityCase.updateMany.mockResolvedValue({ count: 1 });
    tx.platformAuditEvent.create.mockResolvedValue({});
    tx.complianceNotification.create.mockResolvedValue({});
    tx.continuityAsset.findMany.mockResolvedValue([]);
    tx.continuityRunbook.findMany.mockResolvedValue([]);
    tx.continuityTransmissionPackage.upsert.mockResolvedValue({});
  });

  it("queues one warning seven days before trigger and writes an audit event", async () => {
    const lastActivity = new Date("2026-01-01T00:00:00.000Z");
    prismaMock.successor.findMany.mockResolvedValue([{
      id: "successor-1", ownerId: "owner-1", autoActivateAfterDays: 30,
      lastOwnerActivityAt: lastActivity, warningSentAt: null, owner: { email: "owner@example.test" }, continuityCases: [],
    }]);

    const result = await runSuccessorContinuityWorker(new Date("2026-01-24T00:00:00.000Z"));

    expect(result).toMatchObject({ examined: 1, warningsQueued: 1, reviewCasesOpened: 0 });
    expect(tx.successor.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "successor-1", status: { in: [SuccessorStatus.PENDING, SuccessorStatus.ACCEPTED] } }),
    }));
    expect(tx.businessContinuityCase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ContinuityCaseStatus.WARNING_SENT }),
    }));
    expect(tx.complianceNotification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ dedupeKey: "continuity-warning-case-1", channel: "EMAIL" }),
    }));
    expect(tx.platformAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "handover_warning_sent", outcome: "SUCCESS" }),
    }));
  });

  it("opens review only after trigger and seven-day warning window, and generates a transmission manifest", async () => {
    const lastActivity = new Date("2026-01-01T00:00:00.000Z");
    prismaMock.successor.findMany.mockResolvedValue([{
      id: "successor-1", ownerId: "owner-1", autoActivateAfterDays: 30,
      lastOwnerActivityAt: lastActivity, warningSentAt: new Date("2026-01-24T00:00:00.000Z"),
      owner: { email: "owner@example.test" },
      continuityCases: [{ id: "case-1", status: ContinuityCaseStatus.WARNING_SENT, warningSentAt: new Date("2026-01-24T00:00:00.000Z") }],
    }]);
    tx.continuityAsset.findMany.mockResolvedValue([{
      id: "asset-1", assetType: "GitHub repository", label: "platform", recoveryLocation: "GitHub org", criticality: "HIGH", updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }]);
    tx.continuityRunbook.findMany.mockResolvedValue([{
      id: "runbook-1", title: "Deploy", content: "Use the approved workflow.", version: 1, updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }]);

    const result = await runSuccessorContinuityWorker(new Date("2026-01-31T00:00:00.000Z"));

    expect(result).toMatchObject({ reviewCasesOpened: 1, packagesGenerated: 1 });
    expect(tx.businessContinuityCase.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "case-1", status: ContinuityCaseStatus.WARNING_SENT },
      data: expect.objectContaining({ status: ContinuityCaseStatus.REVIEW_REQUIRED }),
    }));
    expect(tx.continuityTransmissionPackage.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { caseId: "case-1" },
      create: expect.objectContaining({ manifest: expect.objectContaining({ packageType: "BUSINESS_CONTINUITY_REVIEW" }) }),
    }));
    expect(tx.platformAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "handover_review_required", outcome: "SUCCESS" }),
    }));
  });

  it("does not run when activity is too recent to warn", async () => {
    prismaMock.successor.findMany.mockResolvedValue([{
      id: "successor-1", ownerId: "owner-1", autoActivateAfterDays: 60,
      lastOwnerActivityAt: new Date("2026-01-01T00:00:00.000Z"), warningSentAt: null,
      owner: { email: "owner@example.test" }, continuityCases: [],
    }]);

    const result = await runSuccessorContinuityWorker(new Date("2026-01-10T00:00:00.000Z"));

    expect(result).toMatchObject({ examined: 1, warningsQueued: 0, reviewCasesOpened: 0 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
