"use client";

import { Check, CirclePlay, FileCheck2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormationStatusBadge } from "./FormationStatusBadge";

type Task = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: string;
  requiresProfessionalReview: boolean;
  reviewCompleted: boolean;
  blockingReason?: string;
  evidenceRequirements: Array<{
    key: string;
    label: string;
    required: boolean;
    satisfied: boolean;
  }>;
};

type Stage = {
  key: string;
  title: string;
  description: string;
  status: string;
  tasks: Task[];
};

export function FormationTimeline({
  planId,
  planClientId,
  stages,
  documents,
  canManage,
  canReview,
}: {
  planId: string;
  planClientId: string;
  stages: Stage[];
  documents: Array<{ id: string; name: string }>;
  canManage: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [busyTask, setBusyTask] = useState("");
  const [message, setMessage] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<Record<string, string>>({});

  async function runAction(taskId: string, action: string, extra: Record<string, string> = {}) {
    setBusyTask(taskId);
    setMessage("");
    try {
      const response = await fetch(`/api/formation/plans/${planId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update formation task.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update formation task.");
    } finally {
      setBusyTask("");
    }
  }

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
                  <div key={task.key} className="rounded-lg border border-white/5 bg-black/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
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
                    {task.evidenceRequirements.length ? (
                      <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                        {task.evidenceRequirements.map((requirement) => (
                          <div key={requirement.key} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={requirement.satisfied ? "text-emerald-300" : "text-slate-400"}>
                              {requirement.satisfied ? "Evidence attached" : "Required evidence"}: {requirement.label}
                            </span>
                            {canManage && !requirement.satisfied ? (
                              <>
                                <label className="sr-only" htmlFor={`evidence-${task.id}-${requirement.key}`}>Document for {requirement.label}</label>
                                <select
                                  id={`evidence-${task.id}-${requirement.key}`}
                                  className="min-h-9 min-w-48 rounded-md border border-white/10 bg-[#0b1128] px-2 text-xs text-white"
                                  value={selectedDocuments[`${task.id}:${requirement.key}`] ?? ""}
                                  onChange={(event) => setSelectedDocuments((current) => ({ ...current, [`${task.id}:${requirement.key}`]: event.target.value }))}
                                >
                                  <option value="">Select client document</option>
                                  {documents.map((document) => (
                                    <option key={document.id} value={document.id}>{document.name}</option>
                                  ))}
                                </select>
                                <button
                                  className="icon-button"
                                  type="button"
                                  title="Attach evidence"
                                  aria-label={`Attach evidence for ${requirement.label}`}
                                  disabled={busyTask === task.id || !selectedDocuments[`${task.id}:${requirement.key}`]}
                                  onClick={() => runAction(task.id, "SATISFY_EVIDENCE", {
                                    evidenceRequirementKey: requirement.key,
                                    evidenceId: selectedDocuments[`${task.id}:${requirement.key}`],
                                  })}
                                >
                                  <FileCheck2 size={15} />
                                </button>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {canManage && !["COMPLETED", "WAIVED"].includes(task.status) ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                        {["PENDING", "READY"].includes(task.status) ? (
                          <button className="button gap-2" type="button" disabled={busyTask === task.id} onClick={() => runAction(task.id, "START")}>
                            <CirclePlay size={14} /> Start
                          </button>
                        ) : null}
                        {task.requiresProfessionalReview && !task.reviewCompleted && canReview ? (
                          <button className="button gap-2" type="button" disabled={busyTask === task.id} onClick={() => runAction(task.id, "REVIEW_APPROVE")}>
                            <ShieldCheck size={14} /> Approve review
                          </button>
                        ) : null}
                        <button className="button button-primary gap-2" type="button" disabled={busyTask === task.id} onClick={() => runAction(task.id, "COMPLETE")}>
                          <Check size={14} /> Complete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
      {message ? <p role="alert" className="text-sm text-rose-300">{message}</p> : null}
    </div>
  );
}
