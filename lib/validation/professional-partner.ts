import { z } from "zod";
import { ProfessionalPartnerCapability, ProfessionalPartnerGrantPurpose, ProfessionalPartnerType } from "@prisma/client";

const nullableDate = z.preprocess((value) => value === null ? null : value, z.coerce.date().nullable());

// Only capabilities backed by submitted partner endpoints can be granted. Enum
// values for graph, document metadata and report access remain reserved until the
// corresponding scoped endpoint and authorization tests are delivered.
const currentlySupportedCapabilities = new Set<ProfessionalPartnerCapability>([
  ProfessionalPartnerCapability.CLIENT_PROFILE_READ,
  ProfessionalPartnerCapability.COMPLIANCE_READ,
  ProfessionalPartnerCapability.EVIDENCE_ATTACH,
]);

const capabilitiesSchema = z.array(z.nativeEnum(ProfessionalPartnerCapability)).min(1).max(6)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Capabilities must not contain duplicates." });
    }
    values.forEach((capability, index) => {
      if (!currentlySupportedCapabilities.has(capability)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "This capability is reserved until its protected partner endpoint is implemented and reviewed.",
        });
      }
    });
  });

export const createProfessionalPartnerIdentitySchema = z.object({
  userId: z.string().trim().min(1).max(120),
  contactName: z.string().trim().min(2).max(160),
  organizationName: z.string().trim().min(2).max(200),
  professionalType: z.nativeEnum(ProfessionalPartnerType),
  professionalRegistrationRef: z.string().trim().min(2).max(120).nullable().optional(),
}).strict();

export const reviewProfessionalPartnerIdentitySchema = z.object({
  decision: z.enum(["VERIFY", "REJECT"]),
  note: z.string().trim().min(8).max(2000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const suspendProfessionalPartnerIdentitySchema = z.object({
  reason: z.string().trim().min(8).max(2000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const createProfessionalPartnerGrantSchema = z.object({
  clientId: z.string().trim().min(1).max(120),
  partnerIdentityId: z.string().trim().min(1).max(120),
  purpose: z.nativeEnum(ProfessionalPartnerGrantPurpose),
  purposeDetails: z.string().trim().min(8).max(1000).nullable().optional(),
  capabilities: capabilitiesSchema,
  // Omitted expiry defaults to 90 days. Explicit null means no expiry and is owner-only.
  expiresAt: nullableDate.optional(),
  idempotencyKey: z.string().trim().min(8).max(128),
}).strict().superRefine((value, context) => {
  if (value.purpose === ProfessionalPartnerGrantPurpose.OTHER && (!value.purposeDetails || value.purposeDetails.trim().length < 8)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["purposeDetails"], message: "Describe the purpose when OTHER is selected." });
  }
});

export const reviewProfessionalPartnerGrantSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().min(8).max(2000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const amendProfessionalPartnerGrantSchema = z.object({
  purpose: z.nativeEnum(ProfessionalPartnerGrantPurpose).optional(),
  purposeDetails: z.string().trim().min(8).max(1000).nullable().optional(),
  capabilities: capabilitiesSchema.optional(),
  // Omitted retains the current expiry; explicit null means no expiry and is owner-only.
  expiresAt: nullableDate.optional(),
  reason: z.string().trim().min(8).max(2000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.purpose === undefined && value.purposeDetails === undefined && value.capabilities === undefined && value.expiresAt === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "At least one grant term must be changed." });
  }
  if (value.purpose === ProfessionalPartnerGrantPurpose.OTHER && (!value.purposeDetails || value.purposeDetails.trim().length < 8)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["purposeDetails"], message: "Describe the purpose when OTHER is selected." });
  }
});

export const revokeProfessionalPartnerGrantSchema = z.object({
  reason: z.string().trim().min(8).max(2000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const partnerEvidenceAttachSchema = z.object({
  obligationId: z.string().trim().min(1).max(120),
  documentId: z.string().trim().min(1).max(120),
  note: z.string().trim().min(3).max(2000).optional(),
  sourceReference: z.string().trim().max(2000).optional(),
  validThrough: nullableDate.optional(),
}).strict();
