import { complianceRepository } from "../db/compliance-repository";
import {
  calculateComplianceProgress,
  type ComplianceStatus,
} from "../domain/compliance";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const complianceService = {
  async getSummary(engagementId: string, principal: WorkspacePrincipal) {
    const items = await complianceRepository.listByEngagement(engagementId, principal);
    return { items, progress: calculateComplianceProgress(items) };
  },

  create(input: {
    engagementId?: string;
    clientId?: string;
    category: string;
    title: string;
    jurisdiction?: string;
    dueAt?: Date;
    status?: ComplianceStatus;
  }, principal: WorkspacePrincipal) {
    return complianceRepository.create(input, principal);
  },

  updateStatus(id: string, status: ComplianceStatus, principal: WorkspacePrincipal) {
    return complianceRepository.updateStatus(id, status, principal);
  },
};
