import { z } from "zod";

export const evidenceInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  source: z.string().trim().max(2000).optional().nullable(),
  sourceType: z.string().trim().max(100).optional().nullable(),
  jurisdictionId: z.string().trim().min(1).optional().nullable(),
  complianceItemId: z.string().trim().min(1).optional().nullable(),
  evidenceClass: z.enum(["E0", "E1", "E2", "E3", "E4", "E0_UNKNOWN", "E1_USER_PROVIDED", "E2_SECONDARY", "E3_PRIMARY", "E4_CROSS_VERIFIED"]),
  confidence: z.number().int().min(0).max(100).optional().nullable(),
  reviewStatus: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const sourceInputSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().url().optional().or(z.literal("")),
  sourceType: z.string().trim().min(1),
  publicationDate: z.coerce.date().optional(),
  retrievedAt: z.coerce.date().optional(),
});
