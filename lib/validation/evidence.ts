import { z } from "zod";

export const evidenceInputSchema = z.object({
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  evidenceClass: z.enum(["E0", "E1", "E2", "E3", "E4"]),
  confidence: z.number().int().min(0).max(100).optional(),
  sourceId: z.string().optional(),
  reviewStatus: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const sourceInputSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().url().optional().or(z.literal("")),
  sourceType: z.string().trim().min(1),
  publicationDate: z.coerce.date().optional(),
  retrievedAt: z.coerce.date().optional(),
});
