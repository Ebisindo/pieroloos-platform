import { PageHeader, EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="CONTROL" title="Compliance" description="Track obligations, completion state, jurisdiction context, and future deadlines." />
      <EmptyState
        title="Compliance workspace is initialized"
        description="The application shell and domain foundation are ready. The next implementation slice will connect this module to persistent application data."
      />
    </div>
  );
}
