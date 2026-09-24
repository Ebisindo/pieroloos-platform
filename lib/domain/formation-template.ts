export type FormationTemplateTask = {
  key: string;
  title: string;
  description: string;
  order: number;
  dependsOnTaskKeys?: string[];
  evidenceRequirements?: { key: string; label: string; required: boolean }[];
  requiresProfessionalReview?: boolean;
};

export type FormationTemplateStage = {
  key: string;
  title: string;
  description: string;
  order: number;
  tasks: FormationTemplateTask[];
};

export type FormationTemplate = {
  key: string;
  name: string;
  version: string;
  jurisdictionCode: string;
  stages: FormationTemplateStage[];
};

/**
 * Conservative generic template.
 * It intentionally avoids hard-coded legal/tax claims.
 */
export const genericFormationTemplate: FormationTemplate = {
  key: "generic-business-formation",
  name: "Generic Business Formation",
  version: "1.0",
  jurisdictionCode: "*",
  stages: [
    {
      key: "entity-purpose",
      title: "Entity Purpose & Structure",
      description: "Establish intended entity purpose and structural requirements.",
      order: 10,
      tasks: [
        {
          key: "define-entity-purpose",
          title: "Define entity purpose",
          description: "Document intended business purpose and operating scope.",
          order: 10,
          evidenceRequirements: [{ key: "business-profile", label: "Approved business profile", required: true }],
        },
        {
          key: "confirm-ownership",
          title: "Confirm ownership context",
          description: "Record ownership and control information for the engagement.",
          order: 20,
          dependsOnTaskKeys: ["define-entity-purpose"],
          evidenceRequirements: [{ key: "ownership-record", label: "Ownership information", required: true }],
        },
      ],
    },
    {
      key: "formation-preparation",
      title: "Formation Preparation",
      description: "Prepare formation information and documentation.",
      order: 20,
      tasks: [
        {
          key: "prepare-formation-information",
          title: "Prepare formation information",
          description: "Assemble information required for the selected workflow.",
          order: 10,
          dependsOnTaskKeys: ["confirm-ownership"],
          evidenceRequirements: [{ key: "formation-data", label: "Formation data package", required: true }],
        },
        {
          key: "professional-formation-review",
          title: "Professional formation review",
          description: "Obtain applicable professional review before submission/execution.",
          order: 20,
          dependsOnTaskKeys: ["prepare-formation-information"],
          requiresProfessionalReview: true,
        },
      ],
    },
    {
      key: "entity-formation",
      title: "Entity Formation",
      description: "Coordinate the actual formation workflow.",
      order: 30,
      tasks: [
        {
          key: "formation-submission",
          title: "Coordinate formation submission",
          description: "Coordinate submission through the appropriate provider or authority.",
          order: 10,
          dependsOnTaskKeys: ["professional-formation-review"],
          evidenceRequirements: [{ key: "submission-proof", label: "Submission evidence", required: true }],
        },
        {
          key: "formation-confirmation",
          title: "Record formation confirmation",
          description: "Record evidence of the formation outcome.",
          order: 20,
          dependsOnTaskKeys: ["formation-submission"],
          evidenceRequirements: [{ key: "formation-proof", label: "Formation confirmation", required: true }],
        },
      ],
    },
    {
      key: "post-formation",
      title: "Post-Formation Setup",
      description: "Coordinate downstream operational setup.",
      order: 40,
      tasks: [
        {
          key: "governance-setup",
          title: "Governance setup",
          description: "Organize applicable governance documentation and records.",
          order: 10,
          dependsOnTaskKeys: ["formation-confirmation"],
        },
        {
          key: "tax-identification-setup",
          title: "Tax / identification setup",
          description: "Coordinate applicable identification and professional review workflows.",
          order: 20,
          dependsOnTaskKeys: ["formation-confirmation"],
          requiresProfessionalReview: true,
        },
        {
          key: "banking-payment-infrastructure",
          title: "Banking & payment infrastructure",
          description: "Coordinate banking/payment infrastructure subject to provider requirements.",
          order: 30,
          dependsOnTaskKeys: ["formation-confirmation"],
          requiresProfessionalReview: true,
        },
        {
          key: "compliance-handoff",
          title: "Compliance calendar handoff",
          description: "Create the handoff into the Compliance subsystem.",
          order: 40,
          dependsOnTaskKeys: ["governance-setup", "tax-identification-setup"],
        },
      ],
    },
  ],
};
