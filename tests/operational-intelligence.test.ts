import { describe, expect, it } from "vitest";
import { buildCommandCenterSnapshot } from "@/lib/services/command-center-service";
import type { EvidenceDocument } from "@/lib/domain/evidence";

const rejected: EvidenceDocument = {
  id: "d1", organizationId: "org1", name: "Rejected filing", documentType: "COMPLIANCE",
  mimeType: "application/pdf", sizeBytes: 100, storageKey: "org1/ws1/doc/d1.pdf",
  evidenceClass: "E3", confidence: 0.8, reviewStatus: "REJECTED", version: 1,
  contentHash: "hash", uploadedByUserId: "u1", createdAt: new Date(), updatedAt: new Date(),
};

describe("operational intelligence", () => {
  it("raises degraded health for critical evidence signals", () => {
    const snapshot = buildCommandCenterSnapshot({ documents: [rejected], obligationIds: [] });
    expect(snapshot.health.state).toBe("DEGRADED");
    expect(snapshot.evidence.criticalSignals).toBeGreaterThan(0);
  });
});
