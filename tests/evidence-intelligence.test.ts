import { describe, expect, it } from "vitest";
import { assessEvidence } from "@/lib/domain/evidence-intelligence";
import type { EvidenceDocument } from "@/lib/domain/evidence";

const base = {
  id: "d1",
  organizationId: "org1",
  complianceObligationId: "obl1",
  name: "Official filing",
  documentType: "COMPLIANCE" as const,
  mimeType: "application/pdf",
  sizeBytes: 1000,
  storageKey: "org1/obl1/d1.pdf",
  evidenceClass: "E3" as const,
  confidence: 0.8,
  reviewStatus: "VERIFIED" as const,
  version: 1,
  contentHash: "abc",
  uploadedByUserId: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("evidence intelligence", () => {
  it("marks verified primary evidence as partial when cross-verification is absent", () => {
    const result = assessEvidence("obl1", [base as EvidenceDocument]);
    expect(result.strongestEvidenceClass).toBe("E3");
    expect(result.verifiedCount).toBe(1);
    expect(result.status).toBe("PARTIAL");
  });

  it("marks cross-verified evidence as sufficient", () => {
    const result = assessEvidence("obl1", [{
      ...base,
      evidenceClass: "E4",
      confidence: 1,
    } as EvidenceDocument]);
    expect(result.status).toBe("SUFFICIENT");
    expect(result.confidence).toBe(1);
  });
});
