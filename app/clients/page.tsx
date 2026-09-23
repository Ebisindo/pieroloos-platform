import { PageHeader, EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="CLIENT OPERATIONS" title="Clients" description="Structured client records and intake workflows." />
      <EmptyState
        title="Clients workspace is initialized"
        description="The application shell and domain foundation are ready. The next implementation slice will connect this module to persistent application data."
      />
    </div>
  );
}
