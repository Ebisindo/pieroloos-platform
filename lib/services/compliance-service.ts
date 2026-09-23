import { complianceRepository } from "../db/compliance-repository";
import { calculateComplianceProgress } from "../domain/compliance";

export const complianceService = {
  async getSummary(engagementId: string) {
    const items = await complianceRepository.listByEngagement(engagementId);
    return { items, progress: calculateComplianceProgress(items) };
  },
  create(input: { engagementId?: string; category: string; title: string; jurisdiction?: string; dueAt?: Date }) { return complianceRepository.create(input); },
  updateStatus(id: string, status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED") { return complianceRepository.updateStatus(id, status); },
};
