import Link from "next/link";

export function WorkspaceAccessState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <section className="glass-panel max-w-2xl p-7">
      <p className="eyebrow">WORKSPACE ACCESS</p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
      {href && action ? (
        <Link className="button button-primary mt-5" href={href}>
          {action}
        </Link>
      ) : null}
    </section>
  );
}