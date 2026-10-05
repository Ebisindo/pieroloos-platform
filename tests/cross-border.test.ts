import { describe, expect, it } from "vitest";
import { isCrossBorderDossierReadyForReview } from "@/lib/domain/cross-border";

describe("cross-border dossier review readiness", () => {
  it("requires at least one control and all applicable controls to be complete", () => {
    expect(isCrossBorderDossierReadyForReview([])).toBe(false);
    expect(isCrossBorderDossierReadyForReview([
      { status: "COMPLETE", requiresEvidence: false, evidenceCount: 0 },
      { status: "NOT_APPLICABLE", requiresEvidence: true, evidenceCount: 0 },
    ])).toBe(true);
  });

  it("requires linked evidence for evidence-required complete controls", () => {
    expect(isCrossBorderDossierReadyForReview([
      { status: "COMPLETE", requiresEvidence: true, evidenceCount: 0 },
    ])).toBe(false);
    expect(isCrossBorderDossierReadyForReview([
      { status: "COMPLETE", requiresEvidence: true, evidenceCount: 1 },
    ])).toBe(true);
  });
});
