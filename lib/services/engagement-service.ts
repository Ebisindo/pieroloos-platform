import { engagementRepository } from "../db/engagement-repository";

export const engagementService = {
  create(input: { workspaceId: string; clientId: string; service: string; nextAction?: string; notes?: string }) {
    if (!input.service.trim()) throw new Error("SERVICE_REQUIRED");
    return engagementRepository.create(input);
  },
  get(id: string) { return engagementRepository.findById(id); },
  list(workspaceId: string) { return engagementRepository.listByWorkspace(workspaceId); },
};
