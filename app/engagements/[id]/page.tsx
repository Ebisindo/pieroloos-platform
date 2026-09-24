import { notFound } from "next/navigation";
import { engagementRepository } from "@/lib/db/engagement-repository";
import { StatusBadge } from "@/components/engagement/StatusBadge";
import { ActivityTimeline } from "@/components/engagement/ActivityTimeline";

type Props = { params: Promise<{ id: string }> };

type BusinessProfileData = {
  businessName?: string;
};

export default async function EngagementPage({ params }: Props) {
  const { id } = await params;
  const engagement = await engagementRepository.findById(id);

  if (!engagement) notFound();

  const profileData =
    engagement.client.businessProfile?.data &&
    typeof engagement.client.businessProfile.data === "object" &&
    !Array.isArray(engagement.client.businessProfile.data)
      ? (engagement.client.businessProfile.data as BusinessProfileData)
      : {};

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">
          Engagement Operations
        </p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {engagement.service}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {engagement.client.name}
            </p>
          </div>
          <StatusBadge status={engagement.status as never} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">
            Operational History
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Activity Timeline
          </h2>
          <div className="mt-6">
            <ActivityTimeline
              activities={engagement.activities.map((activity) => ({
                id: activity.id,
                type: activity.type,
                title: activity.type,
                description: activity.summary,
                createdAt: activity.createdAt.toISOString(),
              }))}
            />
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300/70">
              Next Action
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {engagement.nextAction || "No next action has been defined."}
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">
              Business Context
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {profileData.businessName || "Business profile not yet named."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
