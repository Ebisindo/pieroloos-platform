export const FORMATION_STAGES = [
  "DEFINE_ENTITY_PURPOSE",
  "VALIDATE_JURISDICTION",
  "PREPARE_FORMATION_INFORMATION",
  "FORM_ENTITY",
  "GOVERNANCE_SETUP",
  "TAX_IDENTIFICATION_SETUP",
  "BANKING",
  "PAYMENT_INFRASTRUCTURE",
  "OPERATIONAL_INFRASTRUCTURE",
  "IP_OWNERSHIP",
  "CONTRACTOR_FRAMEWORK",
  "CAPITAL_READINESS",
  "COMPLIANCE_CALENDAR",
  "LAUNCH_MONITORING",
] as const;

export type FormationStage = (typeof FORMATION_STAGES)[number];

export interface FormationStepInput {
  stage: FormationStage;
  title: string;
  description?: string;
  order: number;
  required: boolean;
}
