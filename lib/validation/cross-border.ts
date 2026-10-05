import { z } from "zod";

export const createCrossBorderDossierSchema = z.object({
  clientId: z.string().min(1),
  marketEntryPlanId: z.string().min(1).nullable().optional(),
  originJurisdictionId: z.string().min(1),
  destinationJurisdictionId: z.string().min(1),
  counterpartyName: z.string().trim().min(2).max(240),
  counterpartyCountry: z.string().trim().max(120).optional(),
  activityDescription: z.string().trim().min(10).max(4000),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
  estimatedValue: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/).optional(),
}).refine((value) => value.originJurisdictionId !== value.destinationJurisdictionId, {
  message: "Origin and destination must be different jurisdictions.",
  path: ["destinationJurisdictionId"],
});

export const createCrossBorderControlSchema = z.object({
  category: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(2000).optional(),
  requiresEvidence: z.boolean().default(false),
  expectedVersion: z.number().int().positive(),
});

export const attachCrossBorderEvidenceSchema = z.object({
  documentId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

export const updateCrossBorderControlSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETE", "NOT_APPLICABLE"]),
  expectedVersion: z.number().int().positive(),
});

export const reviewCrossBorderDossierSchema = z.object({
  status: z.enum(["REVIEWED", "CHANGES_REQUESTED"]),
  note: z.string().trim().min(10).max(4000),
  expectedVersion: z.number().int().positive(),
});
