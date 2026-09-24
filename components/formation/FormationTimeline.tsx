import { FormationStatusBadge } from "./FormationStatusBadge";

type Task = {
  key: string;
  title: string;
  description: string;
  status: string;
  requiresProfessionalReview: boolean;
  blockingReason?: string;
};

type Stage = {
  key: string;
  title: string;
  description: string;
  status: string;
  tasks: Task[];
};

export function FormationTimeline({ stages }: { stages: Stage[] }) {
  return (
    <div className="space-y-5">
      {stages.map((stage, index) => (
        <section key={stage.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.05] text-xs text-cyan-200">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">{stage.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{stage.description}</p>
                </div>
                <FormationStatusBadge status={stage.status} />
              </div>
              <div className="mt-5 space-y-2">
                {stage.tasks.map((task) => (
                  <div key={task.key} className="rounded-xl border border-white/5 bg-black/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{task.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{task.description}</p>
                      </div>
                      <FormationStatusBadge status={task.status} />
                    </div>
                    {task.requiresProfessionalReview && (
                      <p className="mt-3 text-[10px] uppercase tracking-[0.15em] text-amber-300">
                        Professional review gate
                      </p>
                    )}
                    {task.blockingReason && (
                      <p className="mt-3 text-xs text-rose-300">{task.blockingReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
