import { PageHeader, EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="OUTPUT" title="Reports" description="Generate structured reports from client, evidence, jurisdiction, formation, and compliance data." />
      <EmptyState
        title="Reports workspace is initialized"
        description="The application shell and domain foundation are ready. The next implementation slice will connect this module to persistent application data."
      />
    </div>
  );
}
