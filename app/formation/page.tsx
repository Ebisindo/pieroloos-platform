import { PageHeader, EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="EXECUTION" title="Formation Roadmap" description="Turn an approved business objective into an ordered, auditable formation workflow." />
      <EmptyState
        title="Formation Roadmap workspace is initialized"
        description="The application shell and domain foundation are ready. The next implementation slice will connect this module to persistent application data."
      />
    </div>
  );
}
