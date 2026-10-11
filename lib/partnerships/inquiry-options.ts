// Client-safe constants; kept free of zod so the public form does not bundle the validator.
export const PARTNERSHIP_INQUIRY_TYPES = [
  "PROFESSIONAL_SERVICES",
  "TECHNOLOGY_PROVIDER",
  "FINANCIAL_INSTITUTION",
  "INSTITUTIONAL_PARTNER",
  "STRATEGIC_SPONSOR_INVESTOR",
  "DISTRIBUTION_ECOSYSTEM",
] as const;

export const PARTNERSHIP_INQUIRY_TYPE_LABELS: Record<(typeof PARTNERSHIP_INQUIRY_TYPES)[number], string> = {
  PROFESSIONAL_SERVICES: "Professional services",
  TECHNOLOGY_PROVIDER: "Technology provider",
  FINANCIAL_INSTITUTION: "Financial institution",
  INSTITUTIONAL_PARTNER: "Institutional partner",
  STRATEGIC_SPONSOR_INVESTOR: "Strategic sponsor or investor",
  DISTRIBUTION_ECOSYSTEM: "Distribution and ecosystem partner",
};

export const PARTNERSHIP_MESSAGE_MAX = 4000;
