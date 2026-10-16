import type { CorporateGraphRelationType, CorporateRuleReviewStatus, EvidenceClass } from "@prisma/client";
export type GraphEdgeInput = { fromNodeId: string; toNodeId: string; relation: CorporateGraphRelationType; ownershipPercent?: number; notes?: string };
export type ComplianceRuleRecord = { id: string; jurisdictionCode: string; entityType: string; ruleKey: string; title: string; description: string | null; frequency: string | null; severity: string; sourceTitle: string | null; sourceUrl: string | null; sourceAuthority: string | null; sourceRetrievedAt: Date | null; effectiveFrom: Date | null; effectiveTo: Date | null; evidenceClass: EvidenceClass; reviewStatus: CorporateRuleReviewStatus; requiresProfessionalReview: boolean; active: boolean; version: number };
export function validateGraphEdge(input: GraphEdgeInput): string | null {
  if (!input.fromNodeId || !input.toNodeId) return "Both graph nodes are required.";
  if (input.fromNodeId === input.toNodeId) return "A node cannot be related to itself.";
  if (input.ownershipPercent !== undefined && (!Number.isFinite(input.ownershipPercent) || input.ownershipPercent < 0 || input.ownershipPercent > 100)) return "Ownership percentage must be between 0 and 100.";
  return null;
}
export function wouldCreateOwnershipCycle(edges: Array<{ fromNodeId: string; toNodeId: string; relation: CorporateGraphRelationType }>, next: GraphEdgeInput): boolean {
  const isOwnership = (relation: CorporateGraphRelationType) => relation === "OWNS" || relation === "CONTROLS" || relation === "SUBSIDIARY_OF";
  if (!isOwnership(next.relation)) return false;
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isOwnership(edge.relation)) continue;
    const from = edge.relation === "SUBSIDIARY_OF" ? edge.toNodeId : edge.fromNodeId;
    const to = edge.relation === "SUBSIDIARY_OF" ? edge.fromNodeId : edge.toNodeId;
    graph.set(from, [...(graph.get(from) ?? []), to]);
  }
  const start = next.relation === "SUBSIDIARY_OF" ? next.fromNodeId : next.toNodeId;
  const target = next.relation === "SUBSIDIARY_OF" ? next.toNodeId : next.fromNodeId;
  const stack = [start]; const visited = new Set<string>();
  while (stack.length) {
    const node = stack.pop(); if (!node) continue;
    if (node === target) return true;
    if (visited.has(node)) continue;
    visited.add(node); stack.push(...(graph.get(node) ?? []));
  }
  return false;
}
export function assessComplianceRule(rule: ComplianceRuleRecord, asOf = new Date()) {
  const gaps: string[] = [];
  if (!rule.sourceTitle?.trim() || !rule.sourceUrl?.trim() || !rule.sourceAuthority?.trim()) gaps.push("SOURCE_METADATA_INCOMPLETE");
  if (!rule.sourceRetrievedAt || Number.isNaN(rule.sourceRetrievedAt.getTime())) gaps.push("MISSING_RETRIEVAL_DATE");
  if (rule.evidenceClass !== "E3" && rule.evidenceClass !== "E4") gaps.push("EVIDENCE_BELOW_PRIMARY");
  if (rule.reviewStatus !== "VERIFIED") gaps.push("SOURCE_NOT_VERIFIED");
  if (rule.effectiveFrom && rule.effectiveFrom > asOf) gaps.push("NOT_YET_EFFECTIVE");
  if (rule.effectiveTo && rule.effectiveTo < asOf) gaps.push("SOURCE_EXPIRED");
  const sourceReady = gaps.length === 0 && rule.active;
  return { sourceReady, gaps, professionalReviewRequired: rule.requiresProfessionalReview || !sourceReady || rule.severity === "HIGH" || rule.severity === "CRITICAL", notice: sourceReady ? "Source metadata and review state are recorded. Confirm the rule against the linked official source; this is not professional advice." : "This rule is not sufficiently source-verified for reliance. Treat it as a review lead, not a definitive obligation." };
}
