export interface ClientIntakeFacts {
  founderName: string;
  email?: string;
  country?: string;
  proposedBusiness?: string;
  businessType?: string;
  businessObjective?: string;
  requestedService?: string;
  targetMarket?: string;
  businessModel?: string;
  fundingContext?: string;
  ownershipContext?: string;
  constraints?: string[];
  notes?: string;
}

export interface BusinessProfileData {
  businessIdentity?: string;
  businessModel?: string;
  targetMarket?: string;
  revenueModel?: string;
  ownership?: string;
  expansionObjectives?: string[];
  fundingStage?: string;
  risksAndConstraints?: string[];
  strategicNotes?: string;
  operationalContext?: string;
}
