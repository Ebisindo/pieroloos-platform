export type InformationClassification =
  | "FACT"
  | "ASSUMPTION"
  | "UNRESOLVED";

export type IntakeStatus = "DRAFT" | "SUBMITTED" | "REVIEW_REQUIRED" | "COMPLETED";

export interface IntakeField<T = unknown> {
  value: T;
  classification: InformationClassification;
  source?: string;
  notes?: string;
}

export interface ClientIntakeCommand {
  client: {
    legalName: string;
    email?: string;
    phone?: string;
    residenceCountry?: string;
  };
  business: {
    proposedName?: string;
    businessType?: string;
    objective: string;
    targetMarket?: string;
    businessModel?: string;
    revenueModel?: string;
    fundingContext?: string;
    ownershipContext?: string;
    expansionObjectives?: string;
    constraints?: string;
    strategicNotes?: string;
    operationalContext?: string;
  };
  engagement?: {
    service: string;
    status?: string;
    nextAction?: string;
    notes?: string;
  };
  intakeStatus?: IntakeStatus;
}
