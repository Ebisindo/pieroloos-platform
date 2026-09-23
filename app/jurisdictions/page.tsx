import { PageHeader, EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="INTELLIGENCE" title="Jurisdiction Lens" description="Compare jurisdictions through weighted criteria, evidence, assumptions, and review status." />
      <EmptyState
        title="Jurisdiction Lens workspace is initialized"
        description="The application shell and domain foundation are ready. The next implementation slice will connect this module to persistent application data."
      />
    </div>
  );
}
