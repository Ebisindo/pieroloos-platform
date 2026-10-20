import { describe, expect, it } from "vitest";
import {
  createAIExplainabilityRecord,
  recordAIHumanReview,
  validateAIExplainabilityRecord,
  type AIExplainabilityInput,
} from "@/lib/domain/ai-explainability";

const reference = {
  id: "rule:ng-company-registration:v2",
  label: "Company registration obligation",
  dataClass: "AUTHORITATIVE_SOURCE" as const,
  source: {
    id: "source:ng-cac-act",
    title: "Companies and Allied Matters Act",
    type: "STATUTE",
    url: "https://example.gov.ng/companies-act",
    version: "2020",
  },
  recordVersion: "2",
  publicationDate: new Date("2020-01-01T00:00:00.000Z"),
  effectiveDate: new Date("2020-08-07T00:00:00.000Z"),
  retrievedAt: new Date("2026-09-01T00:00:00.000Z"),
  evidenceClass: "E4" as const,
  confidence: 95,
  reviewStatus: "VERIFIED" as const,
  supersessionState: "ACTIVE" as const,
};

const input: AIExplainabilityInput = {
  id: "ai-output-1",
  taskType: "COMPLIANCE_SUMMARY",
  generatedAt: new Date("2026-10-01T00:00:00.000Z"),
  outputText: "The recorded rule requires company registration.",
  dataUsed: [reference],
  claims: [{
    text: "The recorded rule requires company registration.",
    material: true,
    supportingReferenceIds: [reference.id],
  }],
  assumptions: [],
  limitations: ["This summary is not legal advice."],
  boundary: "Decision support only; a qualified professional must confirm applicability.",
};

describe("AI explainability contract", () => {
  it("exposes cited data, source versions, currentness dates, assumptions, and review state", () => {
    const record = createAIExplainabilityRecord(input);

    expect(record.dataUsed[0].source.version).toBe("2020");
    expect(record.claims[0].supportingReferenceIds).toContain(reference.id);
    expect(record.freshness.newestRetrievedAt).toEqual(reference.retrievedAt);
    expect(record.freshness.referencesMissingRetrievalDate).toEqual([]);
    expect(record.humanReview.status).toBe("PENDING");
    expect(record.humanReview.reasonCodes).toContain("HUMAN_REVIEW_POLICY");
    expect(validateAIExplainabilityRecord(record)).toEqual([]);
  });

  it("requires review for unsupported claims, assumptions, missing dates, and unverified data", () => {
    const record = createAIExplainabilityRecord({
      ...input,
      dataUsed: [{
        ...reference,
        id: "user-note-1",
        retrievedAt: null,
        reviewStatus: "USER_PROVIDED",
        supersessionState: null,
      }],
      claims: [{
        text: "This business is licensed.",
        material: true,
        supportingReferenceIds: [],
      }],
      assumptions: [{ text: "The business operates locally.", impact: "May change the applicable rules." }],
    });

    expect(record.humanReview.status).toBe("PENDING");
    expect(record.humanReview.reasonCodes).toEqual(expect.arrayContaining([
      "UNSUPPORTED_MATERIAL_CLAIM",
      "UNVERIFIED_SOURCE",
      "MISSING_RETRIEVAL_DATE",
      "ASSUMPTIONS_PRESENT",
    ]));
    expect(record.freshness.referencesMissingRetrievalDate).toEqual(["user-note-1"]);
    expect(validateAIExplainabilityRecord(record)).toEqual([
      expect.objectContaining({ code: "MATERIAL_CLAIM_WITHOUT_CITATION" }),
    ]);
  });

  it("marks future-effective and superseded sources for explicit review", () => {
    const record = createAIExplainabilityRecord({
      ...input,
      generatedAt: new Date("2026-01-01T00:00:00.000Z"),
      dataUsed: [{
        ...reference,
        effectiveDate: new Date("2027-01-01T00:00:00.000Z"),
        supersessionState: "SUPERSEDED",
      }],
    });

    expect(record.freshness.referencesNotYetEffective).toEqual([reference.id]);
    expect(record.freshness.referencesSupersededOrWithdrawn).toEqual([reference.id]);
    expect(record.humanReview.reasonCodes).toContain("SOURCE_NOT_YET_EFFECTIVE");
    expect(record.humanReview.reasonCodes).toContain("SUPERSEDED_SOURCE");
  });

  it("rejects citations to records not included in the disclosed data set", () => {
    const record = createAIExplainabilityRecord({
      ...input,
      claims: [{
        text: "Unsupported",
        material: true,
        supportingReferenceIds: ["missing-source"],
      }],
    });

    expect(validateAIExplainabilityRecord(record)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CITATION_NOT_IN_DATA_USED" }),
    ]));
    expect(() => recordAIHumanReview(
      record,
      "APPROVED",
      "reviewer-1",
      "Cannot approve without valid citations.",
    )).toThrow("AI output cannot be approved while material claims have invalid citations.");
  });

  it("records a human decision with reviewer, time, and rationale", () => {
    const pending = createAIExplainabilityRecord({
      ...input,
      requestedReviewReasonCodes: ["MODEL_REQUESTED_REVIEW"],
    });
    const reviewedAt = new Date("2026-10-02T12:00:00.000Z");
    const reviewed = recordAIHumanReview(
      pending,
      "APPROVED",
      "reviewer-1",
      "Confirmed the cited source and scope.",
      reviewedAt,
    );

    expect(reviewed.humanReview).toMatchObject({
      status: "APPROVED",
      reviewerUserId: "reviewer-1",
      reviewedAt,
      decisionNote: "Confirmed the cited source and scope.",
    });
    expect(validateAIExplainabilityRecord(reviewed)).toEqual([]);
    expect(() => recordAIHumanReview(
      reviewed,
      "APPROVED",
      "reviewer-2",
      "Duplicate decision.",
    )).toThrow("Only AI outputs pending human review can receive a review decision.");
  });

  it("requires human review before any generated output can be treated as approved", () => {
    const record = createAIExplainabilityRecord(input);

    expect(record.humanReview).toMatchObject({
      required: true,
      status: "PENDING",
      reasonCodes: ["HUMAN_REVIEW_POLICY"],
    });
  });

  it("rejects a review decision with an invalid timestamp", () => {
    const record = createAIExplainabilityRecord(input);

    expect(() => recordAIHumanReview(
      record,
      "APPROVED",
      "reviewer-1",
      "Reviewed.",
      new Date(Number.NaN),
    )).toThrow("A valid review timestamp is required.");
  });
});
