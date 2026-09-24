import { z } from "zod";

export const documentTypeSchema = z.enum([
  "FORMATION", "COMPLIANCE", "IDENTITY", "TAX", "BANKING",
  "CONTRACT", "LICENSE", "REPORT", "SOURCE", "OTHER",
]);

export const evidenceClassSchema = z.enum(["E0", "E1", "E2", "E3", "E4"]);

export const documentMetadataSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().optional(),
  engagementId: z.string().optional(),
  complianceObligationId: z.string().optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
  documentType: documentTypeSchema,
  source: z.string().max(1000).optional(),
  sourceType: z.string().max(120).optional(),
  publicationDate: z.coerce.date().optional(),
  evidenceClass: evidenceClassSchema.default("E0"),
});

export const documentReviewSchema = z.object({
  reviewStatus: z.enum(["UNREVIEWED", "IN_REVIEW", "VERIFIED", "REJECTED", "SUPERSEDED"]),
  reviewedByUserId: z.string().min(1),
});
