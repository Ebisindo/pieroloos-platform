import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
import { JurisdictionCard } from "@/components/jurisdiction/JurisdictionCard";

export default async function JurisdictionsPage() {
  const jurisdictions = await jurisdictionRepository.list();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">
          Corporate Intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Jurisdiction Lens
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Evidence-aware jurisdiction intelligence for structured comparison and professional review.
        </p>
      </header>

      <div className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          Decision-support boundary
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Analytical indicators are internal comparison outputs. They are not legal, tax, regulatory, banking or other professional conclusions.
        </p>
      </div>

      {jurisdictions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          No jurisdiction records have been loaded yet.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {jurisdictions.map((jurisdiction) => (
            <JurisdictionCard
              key={jurisdiction.id}
              jurisdiction={jurisdiction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
