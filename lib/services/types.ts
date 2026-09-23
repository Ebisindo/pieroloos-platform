export type EvidenceClass = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';

export type EvidenceItem = {
  sourceId?: string;
  evidenceClass: EvidenceClass;
  confidence?: number;
  reviewStatus?: string;
  notes?: string;
};

export function evidenceLabel(value: EvidenceClass): string {
  const labels: Record<EvidenceClass, string> = {
    E0: 'Unknown',
    E1: 'User provided',
    E2: 'Secondary evidence',
    E3: 'Primary evidence',
    E4: 'Cross-verified',
  };

  return labels[value];
}
