import { z } from "zod";

const portalResource = z.object({
  resourceType: z.enum(["TASK", "FORMATION_TASK", "OBLIGATION"]),
  resourceId: z.string().trim().min(1).max(128),
}).strict();

export const clientPortalInteractionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("MESSAGE"),
    content: z.string().trim().min(1).max(4000),
    resourceType: portalResource.shape.resourceType.optional(),
    resourceId: portalResource.shape.resourceId.optional(),
  }).strict().refine((value) => Boolean(value.resourceType) === Boolean(value.resourceId), {
    message: "Resource type and ID must be supplied together.",
  }),
  z.object({
    kind: z.literal("COMPLETION_SUBMISSION"),
    ...portalResource.shape,
    content: z.string().trim().min(1).max(4000),
  }).strict(),
  z.object({
    kind: z.literal("ACKNOWLEDGMENT"),
    requestId: z.string().trim().min(1).max(128),
  }).strict(),
]);

export const staffPortalInteractionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("MESSAGE"),
    content: z.string().trim().min(1).max(4000),
    resourceType: portalResource.shape.resourceType.optional(),
    resourceId: portalResource.shape.resourceId.optional(),
  }).strict().refine((value) => Boolean(value.resourceType) === Boolean(value.resourceId), {
    message: "Resource type and ID must be supplied together.",
  }),
  z.object({
    kind: z.literal("ACKNOWLEDGMENT_REQUEST"),
    ...portalResource.shape,
    content: z.string().trim().min(1).max(4000),
  }).strict(),
]);

export const clientPortalReviewSchema = z.object({
  decision: z.enum(["ACCEPTED", "CHANGES_REQUESTED"]),
  note: z.string().trim().max(2000).optional(),
}).strict().refine(
  (value) => value.decision !== "CHANGES_REQUESTED" || Boolean(value.note),
  { message: "Explain which changes are needed before returning a submission.", path: ["note"] },
);
