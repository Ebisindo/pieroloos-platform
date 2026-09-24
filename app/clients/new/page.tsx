import { ClientIntakeForm } from "@/components/forms/ClientIntakeForm";

export default function NewClientPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">Client Operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">New Client Intake</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Capture the client’s operating context once. PieroloOS will use the structured record across
          business profiling, jurisdiction analysis, formation planning, compliance and reporting.
        </p>
      </div>
      <ClientIntakeForm />
    </div>
  );
}
