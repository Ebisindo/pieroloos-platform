import { z } from "zod";

const safeLine = (label: string, min: number, max: number) => z.string().trim()
  .min(min, `${label} must be at least ${min} characters.`)
  .max(max, `${label} must be at most ${max} characters.`)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), `${label} contains unsupported control characters.`);

const optionalLine = (label: string, max: number) => z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? undefined : value,
  safeLine(label, 1, max).optional(),
);

const httpUrl = z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? undefined : value,
  z.string().trim().max(2048).url().refine((value) => {
    try {
      const parsed = new URL(value);
      return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }, "Use a valid HTTP or HTTPS URL without embedded credentials.").optional(),
);

export const exportInstitutionCreateSchema = z.object({
  officialName: safeLine("Official institution name", 2, 200),
  acronym: optionalLine("Acronym", 40),
  aliases: z.array(safeLine("Alias", 1, 120)).max(30).default([]),
  category: z.enum([
    "NATIONAL_EXPORT_PROMOTION", "TRADE_MINISTRY", "EXPORT_DEVELOPMENT",
    "INTERNATIONAL_TRADE_DEPARTMENT", "INVESTMENT_TRADE_PROMOTION",
    "CHAMBER_INDUSTRY_ORGANIZATION", "REGIONAL_TRADE_BODY",
    "MULTILATERAL_TRADE_SUPPORT", "OTHER",
  ]),
  scope: z.enum(["SUBNATIONAL", "NATIONAL", "REGIONAL", "MULTILATERAL", "INTERNATIONAL", "OTHER"]).default("NATIONAL"),
  countryCode: z.preprocess(
    (value) => typeof value === "string" && !value.trim() ? undefined : value,
    z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code.").transform((v) => v.toUpperCase()).optional(),
  ),
  jurisdictions: z.array(safeLine("Jurisdiction", 1, 120)).max(100).default([]),
  officialWebsite: httpUrl,
  mandateSummary: z.preprocess(
    (value) => typeof value === "string" && !value.trim() ? undefined : value,
    z.string().trim().min(10).max(4000).optional(),
  ),
  services: z.array(safeLine("Service", 1, 200)).max(50).default([]),
  collaborationAreas: z.array(safeLine("Collaboration area", 1, 200)).max(50).default([]),
  initialEvidence: z.array(z.object({
    sourceUrl: httpUrl,
    sourceTitle: safeLine("Source title", 2, 240),
    evidenceClass: z.enum(["OFFICIAL_PRIMARY", "WRITTEN_AUTHORIZATION", "SECONDARY", "USER_PROVIDED", "INTERNAL_ASSESSMENT", "OTHER"]),
    supportedClaim: safeLine("Supported claim", 5, 1000),
    notes: z.string().trim().max(2000).optional(),
  }).strict()).max(20).default([]),
}).strict();

export const exportInstitutionStatusSchema = z.object({
  status: z.enum([
    "PROSPECTIVE_NOT_CONFIRMED", "RESEARCHING", "RESEARCHED", "CONCEPT_PREPARED",
    "INTERNAL_REVIEW", "OUTREACH_AUTHORIZED", "CONTACTED", "DISCOVERY_DISCUSSIONS",
    "DUE_DILIGENCE", "DRAFT_TERMS", "WRITTEN_AUTHORIZATION_VERIFIED",
    "ACTIVE_UNDER_SIGNED_AGREEMENT", "PAUSED", "DECLINED", "CLOSED",
  ]),
  reason: safeLine("Reason", 5, 1000),
  agreementEvidenceRef: optionalLine("Agreement evidence reference", 500),
}).strict();

export type ExportInstitutionCreateInput = z.infer<typeof exportInstitutionCreateSchema>;
export type ExportInstitutionStatusInput = z.infer<typeof exportInstitutionStatusSchema>;
