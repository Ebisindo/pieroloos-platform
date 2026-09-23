export const EVIDENCE_CLASSES = {
  E0: "Unknown",
  E1: "User provided",
  E2: "Secondary evidence",
  E3: "Primary evidence",
  E4: "Cross-verified",
} as const;

export type EvidenceClass = keyof typeof EVIDENCE_CLASSES;

export interface EvidenceRecord {
  id: string;
  subjectType: string;
  subjectId: string;
  evidenceClass: EvidenceClass;
  confidence?: number;
  sourceId?: string;
  reviewStatus?: string;
  notes?: string;
}
