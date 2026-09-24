type Activity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string | Date;
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (!activities.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
        No activity has been recorded yet.
      </div>
    );
  }

  return (
    <ol className="relative ml-3 border-l border-white/10">
      {activities.map((activity) => (
        <li key={activity.id} className="relative pb-7 pl-7 last:pb-0">
          <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border border-cyan-300/50 bg-slate-950" />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white">{activity.title}</p>
              {activity.description && (
                <p className="mt-1 text-sm leading-6 text-slate-400">{activity.description}</p>
              )}
            </div>
            <span className="text-[11px] uppercase tracking-wider text-slate-600">
              {new Date(activity.createdAt).toLocaleString()}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
