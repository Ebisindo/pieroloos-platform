export const AI_TASK_TYPES = [
  "INTAKE_INTERPRETATION",
  "BUSINESS_STRUCTURE_SUGGESTION",
  "JURISDICTION_COMPARISON",
  "COMPLIANCE_SUMMARY",
  "EVIDENCE_GAP_EXPLANATION",
  "RISK_IDENTIFICATION",
  "REPORT_DRAFT",
  "MEETING_TASK_SUMMARY",
  "CROSS_BORDER_DOSSIER",
  "PROFESSIONAL_HANDOFF",
] as const;

export type AITaskType = typeof AI_TASK_TYPES[number];

export type AIDataClass =
  | "CLIENT_PROVIDED"
  | "AUTHORITATIVE_SOURCE"
  | "VERIFIED_EVIDENCE"
  | "SYSTEM_DERIVED"
  | "UNKNOWN";

export type AIDataReviewStatus =
  | "VERIFIED"
  | "UNREVIEWED"
  | "USER_PROVIDED"
  | "REJECTED"
  | "SUPERSEDED";

export type AISupersessionState =
  | "ACTIVE"
  | "SUPERSEDED"
  | "REPLACED"
  | "REVOKED"
  | "DRAFT";

export const AI_REVIEW_REASON_CODES = [
  "UNSUPPORTED_MATERIAL_CLAIM",
  "UNVERIFIED_SOURCE",
  "SUPERSEDED_SOURCE",
  "SOURCE_NOT_YET_EFFECTIVE",
  "MISSING_RETRIEVAL_DATE",
  "ASSUMPTIONS_PRESENT",
  "HUMAN_REVIEW_POLICY",
  "MODEL_REQUESTED_REVIEW",
] as const;

export type AIReviewReasonCode = typeof AI_REVIEW_REASON_CODES[number];

export type AIDataReference = {
  id: string;
  label: string;
  dataClass: AIDataClass;
  source: {
    id: string;
    title: string;
    type: string;
    url?: string | null;
    version?: string | null;
  };
  recordVersion?: string | null;
  publicationDate?: Date | null;
  effectiveDate?: Date | null;
  retrievedAt?: Date | null;
  evidenceClass?: "E0" | "E1" | "E2" | "E3" | "E4" | null;
  confidence?: number | null;
  reviewStatus: AIDataReviewStatus;
  supersessionState?: AISupersessionState | null;
};

export type AIMaterialClaim = {
  text: string;
  material: boolean;
  supportingReferenceIds: string[];
};

export type AIAssumption = {
  text: string;
  impact: string;
};

export type AIEvidenceFreshness = {
  evaluatedAt: Date;
  oldestRetrievedAt: Date | null;
  newestRetrievedAt: Date | null;
  referencesMissingRetrievalDate: string[];
  referencesNotYetEffective: string[];
  referencesSupersededOrWithdrawn: string[];
};

export type AIHumanReviewStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "CHANGES_REQUESTED";

export type AIHumanReview = {
  required: boolean;
  reasonCodes: AIReviewReasonCode[];
  status: AIHumanReviewStatus;
  reviewerUserId?: string | null;
  reviewedAt?: Date | null;
  decisionNote?: string | null;
};

export type AIExplainabilityRecord = {
  id: string;
  taskType: AITaskType;
  generatedAt: Date;
  outputText: string;
  dataUsed: AIDataReference[];
  claims: AIMaterialClaim[];
  assumptions: AIAssumption[];
  limitations: string[];
  freshness: AIEvidenceFreshness;
  humanReview: AIHumanReview;
  boundary: string;
};

export type AIExplainabilityInput = Omit<
  AIExplainabilityRecord,
  "freshness" | "humanReview"
> & {
  requestedReviewReasonCodes?: AIReviewReasonCode[];
};

export type AIExplainabilityIssueCode =
  | "DUPLICATE_REFERENCE_ID"
  | "MATERIAL_CLAIM_WITHOUT_CITATION"
  | "CITATION_NOT_IN_DATA_USED"
  | "REVIEW_REQUIRED_BUT_NOT_PENDING"
  | "REVIEW_DECISION_MISSING_REVIEWER"
  | "REVIEW_DECISION_MISSING_DATE"
  | "REVIEW_DECISION_MISSING_NOTE";

export type AIExplainabilityIssue = {
  code: AIExplainabilityIssueCode;
  message: string;
  claimIndex?: number;
  referenceId?: string;
};

const UNVERIFIED_STATUSES = new Set<AIDataReviewStatus>([
  "UNREVIEWED",
  "USER_PROVIDED",
  "REJECTED",
  "SUPERSEDED",
]);

function freshnessFor(references: AIDataReference[], evaluatedAt: Date): AIEvidenceFreshness {
  const retrievalDates = references
    .map((reference) => reference.retrievedAt)
    .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  return {
    evaluatedAt,
    oldestRetrievedAt: retrievalDates[0] ?? null,
    newestRetrievedAt: retrievalDates.at(-1) ?? null,
    referencesMissingRetrievalDate: references
      .filter((reference) => !reference.retrievedAt || Number.isNaN(reference.retrievedAt.getTime()))
      .map((reference) => reference.id),
    referencesNotYetEffective: references
      .filter((reference) => reference.effectiveDate && reference.effectiveDate.getTime() > evaluatedAt.getTime())
      .map((reference) => reference.id),
    referencesSupersededOrWithdrawn: references
      .filter((reference) =>
        reference.reviewStatus === "SUPERSEDED" ||
        ["SUPERSEDED", "REPLACED", "REVOKED"].includes(reference.supersessionState ?? ""),
      )
      .map((reference) => reference.id),
  };
}

export function createAIExplainabilityRecord(
  input: AIExplainabilityInput,
): AIExplainabilityRecord {
  const freshness = freshnessFor(input.dataUsed, input.generatedAt);
  const reasons = new Set(input.requestedReviewReasonCodes ?? []);
  reasons.add("HUMAN_REVIEW_POLICY");

  if (input.claims.some((claim) =>
    claim.material && claim.supportingReferenceIds.length === 0,
  )) {
    reasons.add("UNSUPPORTED_MATERIAL_CLAIM");
  }

  if (input.dataUsed.some((reference) =>
    UNVERIFIED_STATUSES.has(reference.reviewStatus) ||
    reference.supersessionState === "DRAFT",
  )) {
    reasons.add("UNVERIFIED_SOURCE");
  }

  if (freshness.referencesSupersededOrWithdrawn.length > 0) {
    reasons.add("SUPERSEDED_SOURCE");
  }

  if (freshness.referencesNotYetEffective.length > 0) {
    reasons.add("SOURCE_NOT_YET_EFFECTIVE");
  }

  if (freshness.referencesMissingRetrievalDate.length > 0) {
    reasons.add("MISSING_RETRIEVAL_DATE");
  }

  if (input.assumptions.length > 0) {
    reasons.add("ASSUMPTIONS_PRESENT");
  }

  const reasonCodes = [...reasons];
  const required = reasonCodes.length > 0;

  return {
    id: input.id,
    taskType: input.taskType,
    generatedAt: input.generatedAt,
    outputText: input.outputText,
    dataUsed: input.dataUsed,
    claims: input.claims,
    assumptions: input.assumptions,
    limitations: input.limitations,
    freshness,
    humanReview: {
      required,
      reasonCodes,
      status: required ? "PENDING" : "NOT_REQUIRED",
    },
    boundary: input.boundary,
  };
}

export function validateAIExplainabilityRecord(
  record: AIExplainabilityRecord,
): AIExplainabilityIssue[] {
  const issues: AIExplainabilityIssue[] = [];
  const references = new Set<string>();
  const duplicateReferences = new Set<string>();

  for (const reference of record.dataUsed) {
    if (references.has(reference.id)) duplicateReferences.add(reference.id);
    references.add(reference.id);
  }

  for (const referenceId of duplicateReferences) {
    issues.push({
      code: "DUPLICATE_REFERENCE_ID",
      referenceId,
      message: `Data reference "${referenceId}" is listed more than once.`,
    });
  }

  record.claims.forEach((claim, claimIndex) => {
    if (claim.material && claim.supportingReferenceIds.length === 0) {
      issues.push({
        code: "MATERIAL_CLAIM_WITHOUT_CITATION",
        claimIndex,
        message: "Material claims must cite at least one data reference.",
      });
    }

    for (const referenceId of claim.supportingReferenceIds) {
      if (!references.has(referenceId)) {
        issues.push({
          code: "CITATION_NOT_IN_DATA_USED",
          claimIndex,
          referenceId,
          message: `Citation "${referenceId}" is not present in the output's data-used list.`,
        });
      }
    }
  });

  if (record.humanReview.required && record.humanReview.status !== "PENDING" &&
      record.humanReview.status !== "APPROVED" &&
      record.humanReview.status !== "CHANGES_REQUESTED") {
    issues.push({
      code: "REVIEW_REQUIRED_BUT_NOT_PENDING",
      message: "An output requiring human review must be pending or have a recorded decision.",
    });
  }

  if (["APPROVED", "CHANGES_REQUESTED"].includes(record.humanReview.status)) {
    if (!record.humanReview.reviewerUserId?.trim()) {
      issues.push({
        code: "REVIEW_DECISION_MISSING_REVIEWER",
        message: "A human review decision must identify the reviewer.",
      });
    }

    if (!record.humanReview.reviewedAt ||
        Number.isNaN(record.humanReview.reviewedAt.getTime())) {
      issues.push({
        code: "REVIEW_DECISION_MISSING_DATE",
        message: "A human review decision must include its timestamp.",
      });
    }

    if (!record.humanReview.decisionNote?.trim()) {
      issues.push({
        code: "REVIEW_DECISION_MISSING_NOTE",
        message: "A human review decision must include its rationale.",
      });
    }
  }

  return issues;
}

export function recordAIHumanReview(
  record: AIExplainabilityRecord,
  decision: "APPROVED" | "CHANGES_REQUESTED",
  reviewerUserId: string,
  decisionNote: string,
  reviewedAt = new Date(),
): AIExplainabilityRecord {
  if (!reviewerUserId.trim()) {
    throw new Error("A reviewer user ID is required.");
  }
  if (record.humanReview.status !== "PENDING") {
    throw new Error("Only AI outputs pending human review can receive a review decision.");
  }
  if (!decisionNote.trim()) {
    throw new Error("A review decision note is required.");
  }
  if (Number.isNaN(reviewedAt.getTime())) {
    throw new Error("A valid review timestamp is required.");
  }
  if (decision === "APPROVED" && validateAIExplainabilityRecord(record).some((issue) =>
    ["DUPLICATE_REFERENCE_ID", "MATERIAL_CLAIM_WITHOUT_CITATION", "CITATION_NOT_IN_DATA_USED"].includes(issue.code),
  )) {
    throw new Error("AI output cannot be approved while material claims have invalid citations.");
  }

  return {
    ...record,
    humanReview: {
      ...record.humanReview,
      status: decision,
      reviewerUserId,
      reviewedAt,
      decisionNote: decisionNote.trim(),
    },
  };
}
