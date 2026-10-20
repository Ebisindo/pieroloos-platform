import { evidenceRepository } from "../db/evidence-repository";
import { evidenceInputSchema, sourceInputSchema } from "../validation/evidence";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const evidenceService = {
  create(input: unknown, principal: WorkspacePrincipal) {
    return evidenceRepository.create(evidenceInputSchema.parse(input), principal);
  },
  createSource(input: unknown, principal: WorkspacePrincipal) {
    return evidenceRepository.createSource(sourceInputSchema.parse(input), principal);
  },
  listForSubject(subjectType: string, subjectId: string, principal: WorkspacePrincipal) {
    return evidenceRepository.listForSubject(subjectType, subjectId, principal);
  },
};
