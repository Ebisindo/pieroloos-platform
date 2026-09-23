import { evidenceRepository } from "../db/evidence-repository";
import { evidenceInputSchema, sourceInputSchema } from "../validation/evidence";

export const evidenceService = {
  create(input: unknown) { return evidenceRepository.create(evidenceInputSchema.parse(input)); },
  createSource(input: unknown) { return evidenceRepository.createSource(sourceInputSchema.parse(input)); },
  listForSubject(subjectType: string, subjectId: string) { return evidenceRepository.listForSubject(subjectType, subjectId); },
};
