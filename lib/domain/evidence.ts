export type EvidenceClass = "E0" | "E1" | "E2" | "E3" | "E4";

export type DocumentReviewStatus =
  | "UNREVIEWED"
  | "IN_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "SUPERSEDED";

export type DocumentType =
  | "FORMATION"
  | "COMPLIANCE"
  | "IDENTITY"
  | "TAX"
  | "BANKING"
  | "CONTRACT"
  | "LICENSE"
  | "REPORT"
  | "SOURCE"
  | "OTHER";

export type EvidenceDocument = {
  id: string;
  organizationId: string;
  clientId?: string | null;
  engagementId?: string | null;
  complianceObligationId?: string | null;
  name: string;
  description?: string | null;
  documentType: DocumentType;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  source?: string | null;
  sourceType?: string | null;
  publicationDate?: Date | null;
  retrievedAt?: Date | null;
  evidenceClass: EvidenceClass;
  confidence: number;
  reviewStatus: DocumentReviewStatus;
  version: number;
  contentHash: string;
  previousVersionId?: string | null;
  uploadedByUserId: string;
  reviewedByUserId?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function isValidEvidenceClass(value: string): value is EvidenceClass {
  return ["E0", "E1", "E2", "E3", "E4"].includes(value);
}

export function evidenceClassLabel(value: EvidenceClass) {
  return ({
    E0: "Unknown",
    E1: "User provided",
    E2: "Secondary evidence",
    E3: "Primary evidence",
    E4: "Cross-verified",
  } satisfies Record<EvidenceClass, string>)[value];
}

export function evidenceConfidence(evidenceClass: EvidenceClass) {
  return ({ E0: 0, E1: 0.35, E2: 0.55, E3: 0.8, E4: 1 })[evidenceClass];
}

export function canVerifyDocument(input: {
  evidenceClass: EvidenceClass;
  reviewStatus: DocumentReviewStatus;
  hasSource: boolean;
  hasIntegrityHash: boolean;
}) {
  return input.evidenceClass !== "E0" &&
    input.reviewStatus === "IN_REVIEW" &&
    input.hasIntegrityHash &&
    input.hasSource;
}
