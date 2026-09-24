import { FormationTimeline } from "@/components/formation/FormationTimeline";

const previewStages = [
  {
    key: "entity-purpose",
    title: "Entity Purpose & Structure",
    description: "Establish the intended entity purpose and structural requirements.",
    status: "READY",
    tasks: [
      {
        key: "define-entity-purpose",
        title: "Define entity purpose",
        description: "Document the intended business purpose and operating scope.",
        status: "READY",
        requiresProfessionalReview: false,
      },
      {
        key: "confirm-ownership",
        title: "Confirm ownership context",
        description: "Record ownership and control information required for the engagement.",
        status: "BLOCKED",
        requiresProfessionalReview: false,
        blockingReason: "Waiting for the entity-purpose task and ownership evidence.",
      },
    ],
  },
  {
    key: "formation-preparation",
    title: "Formation Preparation",
    description: "Prepare formation information and documentation.",
    status: "PENDING",
    tasks: [
      {
        key: "prepare-formation-information",
        title: "Prepare formation information",
        description: "Assemble information required for the selected formation workflow.",
        status: "PENDING",
        requiresProfessionalReview: false,
      },
      {
        key: "professional-formation-review",
        title: "Professional formation review",
        description: "Obtain applicable professional review before submission/execution.",
        status: "PENDING",
        requiresProfessionalReview: true,
      },
    ],
  },
  {
    key: "entity-formation",
    title: "Entity Formation",
    description: "Coordinate the actual formation workflow.",
    status: "PENDING",
    tasks: [
      {
        key: "formation-submission",
        title: "Coordinate formation submission",
        description: "Coordinate submission through the appropriate provider or authority.",
        status: "PENDING",
        requiresProfessionalReview: false,
      },
      {
        key: "formation-confirmation",
        title: "Record formation confirmation",
        description: "Record evidence of the formation outcome.",
        status: "PENDING",
        requiresProfessionalReview: false,
      },
    ],
  },
  {
    key: "post-formation",
    title: "Post-Formation Setup",
    description: "Coordinate downstream operational setup.",
    status: "PENDING",
    tasks: [
      {
        key: "governance-setup",
        title: "Governance setup",
        description: "Organize applicable governance documentation and records.",
        status: "PENDING",
        requiresProfessionalReview: false,
      },
      {
        key: "tax-identification-setup",
        title: "Tax / identification setup",
        description: "Coordinate applicable identification and professional review workflows.",
        status: "PENDING",
        requiresProfessionalReview: true,
      },
      {
        key: "banking-payment-infrastructure",
        title: "Banking & payment infrastructure",
        description: "Coordinate banking/payment infrastructure subject to provider requirements.",
        status: "PENDING",
        requiresProfessionalReview: true,
      },
      {
        key: "compliance-handoff",
        title: "Compliance calendar handoff",
        description: "Create the handoff into the Compliance subsystem.",
        status: "PENDING",
        requiresProfessionalReview: false,
      },
    ],
  },
];

export default function FormationPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-violet-300/70">Formation Operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Formation Roadmap</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Turn an explicitly selected working jurisdiction into an auditable,
          dependency-aware operational formation plan.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Working jurisdiction</p>
          <p className="mt-2 text-lg font-semibold text-white">Awaiting decision</p>
          <p className="mt-1 text-xs text-slate-500">Must be explicitly selected from a comparison snapshot.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow state</p>
          <p className="mt-2 text-lg font-semibold text-white">READY / BLOCKED</p>
          <p className="mt-1 text-xs text-slate-500">Tasks expose dependencies and evidence blockers.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Decision authority</p>
          <p className="mt-2 text-lg font-semibold text-white">Human</p>
          <p className="mt-1 text-xs text-slate-500">PieroloOS prepares and coordinates; humans authorize decisions.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Operational boundary</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          This roadmap is a workflow and coordination system. It does not by itself
          establish legal validity, tax treatment, regulatory approval, banking approval,
          or government acceptance.
        </p>
      </div>

      <FormationTimeline stages={previewStages} />
    </div>
  );
}
