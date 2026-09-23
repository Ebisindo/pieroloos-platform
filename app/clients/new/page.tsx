import { PageHeader, EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="CLIENT INTAKE" title="New Client" description="Capture structured facts, constraints, objectives, and unresolved information." />
      <EmptyState
        title="New Client workspace is initialized"
        description="The application shell and domain foundation are ready. The next implementation slice will connect this module to persistent application data."
      />
    </div>
  );
}
