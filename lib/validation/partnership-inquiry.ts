import { z } from "zod";
import {
  PARTNERSHIP_INQUIRY_TYPES,
  PARTNERSHIP_MESSAGE_MAX,
} from "@/lib/partnerships/inquiry-options";

export {
  PARTNERSHIP_INQUIRY_TYPES,
  PARTNERSHIP_INQUIRY_TYPE_LABELS,
  PARTNERSHIP_MESSAGE_MAX,
} from "@/lib/partnerships/inquiry-options";

const singleLine = (label: string, min: number, max: number) =>
  z.string().trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`)
    .refine(
      (value) => !Array.from(value).some((character) => {
        const code = character.charCodeAt(0);
        return code <= 0x1f || code === 0x7f;
      }),
      `${label} must not contain control characters.`,
    );

const optionalText = (label: string, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    singleLine(label, 1, max).optional(),
  );

const optionalHttpUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(2048, "Website must be at most 2048 characters.")
    .refine((value) => {
      try {
        const url = new URL(value);
        return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "Enter a valid http or https website address.")
    .optional(),
);

export const partnershipInquirySchema = z.object({
  partnerType: z.enum(PARTNERSHIP_INQUIRY_TYPES, { message: "Select a supported partner type." }),
  contactName: singleLine("Name", 2, 120),
  email: z.string().trim().toLowerCase().max(254, "Email must be at most 254 characters.").email("Enter a valid email address."),
  organisationName: singleLine("Organisation", 2, 160),
  websiteUrl: optionalHttpUrl,
  country: optionalText("Country", 80),
  message: z.string().trim()
    .min(20, "Message must be at least 20 characters.")
    .max(PARTNERSHIP_MESSAGE_MAX, `Message must be at most ${PARTNERSHIP_MESSAGE_MAX} characters.`),
  consent: z.literal(true, { message: "You must agree to be contacted about this inquiry." }),
  // Honeypot: real users never see or fill this field.
  hp: z.string().max(0).optional(),
}).strict();

export type PartnershipInquiryInput = z.infer<typeof partnershipInquirySchema>;
