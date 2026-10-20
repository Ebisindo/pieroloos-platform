"use client";

import { localizeApiError } from "@/lib/i18n/api-errors";
import { ArrowRight, Globe2, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatDate, type MessageKey } from "@/lib/i18n/messages";
import { localizeReadinessBoundary, localizeReadinessCheck } from "@/lib/i18n/market-readiness";
import type { MarketEntryReviewStatus, MarketEntryStatus, MarketReadiness } from "@/lib/domain/market-entry";

type CandidateJurisdiction = { id: string; name: string; country: string; countryCode: string | null };
type ComparisonOption = {
  id: string;
  businessProfileId: string;
  businessName: string;
  createdAt: string;
  jurisdictions: CandidateJurisdiction[];
};
type FormationOption = { id: string; businessProfileId: string; jurisdictionId: string; status: string };
type MarketEntryPlanView = {
  id: string;
  businessProfileId: string;
  comparisonSnapshotId: string;
  targetJurisdictionId: string;
  formationPlanId: string | null;
  rationale: string;
  status: MarketEntryStatus;
  reviewStatus: MarketEntryReviewStatus;
  reviewNote: string | null;
  reviewedAssessmentVersion: number | null;
  version: number;
  updatedAt: string;
  businessProfile: { businessName: string | null; client: { name: string | null; organizationName: string | null; firstName: string | null; lastName: string | null } };
  targetJurisdiction: CandidateJurisdiction;
  formationPlan: { id: string; status: string } | null;
  readinessAssessments: Array<{ id: string; status: MarketReadiness["status"]; planVersion: number; resultJson: MarketReadiness; assessedAt: string }>;
};

const checkTone: Record<string, string> = {
  COMPLETE: "status-success",
  IN_PROGRESS: "status-info",
  NEEDS_INPUT: "status-warning",
  NOT_CONFIGURED: "status-warning",
  REVIEW_REQUIRED: "status-warning",
  NOT_ASSESSED: "status-neutral",
};

export function MarketEntryWorkflow({
  comparisons,
  formationPlans,
  plans,
  canManage,
  canLinkFormation,
  canReview,
}: {
  comparisons: ComparisonOption[];
  formationPlans: FormationOption[];
  plans: MarketEntryPlanView[];
  canManage: boolean;
  canLinkFormation: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const dateTime = (value: string) => formatDate(new Date(value), locale, { dateStyle: "medium", timeStyle: "short" });
  const [comparisonId, setComparisonId] = useState("");
  const [targetJurisdictionId, setTargetJurisdictionId] = useState("");
  const [formationPlanId, setFormationPlanId] = useState("");
  const [selectedFormationPlans, setSelectedFormationPlans] = useState<Record<string, string>>({});
  const [rationale, setRationale] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const comparison = comparisons.find((option) => option.id === comparisonId);
  const formationChoices = formationPlans.filter((plan) =>
    plan.businessProfileId === comparison?.businessProfileId
      && plan.jurisdictionId === targetJurisdictionId,
  );

  async function submit(url: string, body: Record<string, unknown>, busyIdValue: string) {
    setBusyId(busyIdValue);
    setError("");
    try {
      const response = await fetch(url, {
        method: url === "/api/market-entry" || url.endsWith("/readiness") || url.endsWith("/review") || url.endsWith("/formation-plan")
          ? "POST"
          : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(localizeApiError(t, result.error, t("marketEntry.updateError")));
      router.refresh();
      return result.data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("marketEntry.updateError"));
      return null;
    } finally {
      setBusyId("");
    }
  }

  async function createPathway(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comparisonId || !targetJurisdictionId) return;
    const result = await submit("/api/market-entry", {
      comparisonSnapshotId: comparisonId,
      targetJurisdictionId,
      rationale,
      ...(formationPlanId ? { formationPlanId } : {}),
    }, "new");
    if (result) {
      setRationale("");
      setFormationPlanId("");
      setTargetJurisdictionId("");
      setComparisonId("");
    }
  }

  async function assessReadiness(plan: MarketEntryPlanView) {
    await submit(`/api/market-entry/${plan.id}/readiness`, {}, plan.id);
  }

  async function updateStatus(plan: MarketEntryPlanView, status: MarketEntryStatus) {
    await submit(`/api/market-entry/${plan.id}`, { status, expectedVersion: plan.version }, plan.id);
  }

  async function reviewPlan(plan: MarketEntryPlanView, reviewStatus: "APPROVED" | "CHANGES_REQUESTED") {
    const note = reviewNotes[plan.id]?.trim();
    if (!note) {
      setError(t("marketEntry.reviewNoteRequired"));
      return;
    }
    await submit(`/api/market-entry/${plan.id}/review`, {
      reviewStatus,
      note,
      expectedVersion: plan.version,
    }, plan.id);
  }

  async function linkFormationPlan(plan: MarketEntryPlanView) {
    const formationPlanId = selectedFormationPlans[plan.id];
    if (!formationPlanId) return;
    await submit(`/api/market-entry/${plan.id}/formation-plan`, {
      formationPlanId,
      expectedVersion: plan.version,
    }, plan.id);
  }

  return (
    <div className="space-y-7">
      {error ? <p className="rounded-lg border border-rose-300/15 bg-rose-300/[0.04] p-3 text-sm text-rose-200" role="alert">{error}</p> : null}

      {canManage ? (
        <section className="glass-panel space-y-4 p-5" aria-labelledby="create-market-entry">
          <header className="section-header">
            <div>
              <h2 id="create-market-entry">{t("marketEntry.create.title")}</h2>
              <p>{t("marketEntry.create.description")}</p>
            </div>
            <Globe2 size={19} aria-hidden="true" className="text-cyan-200" />
          </header>
          {comparisons.length ? (
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={createPathway}>
              <label className="space-y-2 text-sm text-slate-300">
                <span>{t("marketEntry.create.comparison")}</span>
                <select
                  className="form-input"
                  required
                  value={comparisonId}
                  onChange={(event) => {
                    setComparisonId(event.target.value);
                    setTargetJurisdictionId("");
                    setFormationPlanId("");
                  }}
                >
                  <option value="" disabled>{t("marketEntry.create.comparisonPlaceholder")}</option>
                  {comparisons.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.businessName} · {formatDate(new Date(option.createdAt), locale, { dateStyle: "medium" })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>{t("marketEntry.create.target")}</span>
                <select
                  className="form-input"
                  required
                  disabled={!comparison}
                  value={targetJurisdictionId}
                  onChange={(event) => {
                    setTargetJurisdictionId(event.target.value);
                    setFormationPlanId("");
                  }}
                >
                  <option value="" disabled>{t("marketEntry.create.targetPlaceholder")}</option>
                  {comparison?.jurisdictions.map((jurisdiction) => (
                    <option key={jurisdiction.id} value={jurisdiction.id}>
                      {jurisdiction.name} · {jurisdiction.country}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>{t("marketEntry.create.formationPlan")}</span>
                <select
                  className="form-input"
                  value={formationPlanId}
                  disabled={!targetJurisdictionId || !formationChoices.length}
                  onChange={(event) => setFormationPlanId(event.target.value)}
                >
                  <option value="">{t("marketEntry.create.formationPlanPlaceholder")}</option>
                  {formationChoices.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.status} · {plan.id}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
                <span>{t("marketEntry.create.rationale")}</span>
                <textarea
                  className="form-input"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={3}
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  placeholder={t("marketEntry.create.rationalePlaceholder")}
                />
              </label>
              <button className="button button-primary gap-2 sm:col-span-2 sm:justify-self-start" type="submit" disabled={busyId === "new" || !targetJurisdictionId}>
                {t("marketEntry.create.submit")} <ArrowRight size={15} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-400">{t("marketEntry.create.noComparisons")}</p>
          )}
        </section>
      ) : null}

      <section className="space-y-4" aria-labelledby="market-entry-pathways">
        <header className="section-header">
          <div>
            <h2 id="market-entry-pathways">{t("marketEntry.list.title")}</h2>
            <p>{t("marketEntry.list.description")}</p>
          </div>
        </header>
        {!plans.length ? (
          <div className="glass-panel p-6 text-sm text-slate-400">{t("marketEntry.list.empty")}</div>
        ) : plans.map((plan) => {
          const client = plan.businessProfile.client;
          const businessName = plan.businessProfile.businessName
            || client.organizationName
            || client.name
            || [client.firstName, client.lastName].filter(Boolean).join(" ")
            || t("marketEntry.plan.businessFallback");
          const latest = plan.readinessAssessments[0];
          const latestAssessmentIsCurrent = Boolean(latest && (
            latest.planVersion === plan.version
            || (plan.reviewStatus === "APPROVED" && plan.reviewedAssessmentVersion === latest.planVersion)
          ));
          const assessmentCanBeApproved = latest?.resultJson.checks
            .filter((check) => ["business-profile", "formalization", "obligations", "obligation-evidence"].includes(check.key))
            .every((check) => check.status === "COMPLETE") && latest?.resultJson.checks
            .filter((check) => ["business-profile", "formalization", "obligations", "obligation-evidence"].includes(check.key)).length === 4;

          return (
            <article className="glass-panel space-y-4 p-5" key={plan.id}>
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{businessName}</p>
                  <h3 className="text-lg font-semibold text-white">{plan.targetJurisdiction.name} · {plan.targetJurisdiction.country}</h3>
                  <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-400">{plan.rationale}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="status-badge status-info">{t(`marketEntry.status.${plan.status}`)}</span>
                  <span className={plan.reviewStatus === "APPROVED" ? "status-badge status-success" : "status-badge status-warning"}>
                    {t(`marketEntry.reviewStatus.${plan.reviewStatus}`)}
                  </span>
                </div>
              </header>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{t("marketEntry.plan.formation", { status: plan.formationPlan?.status ?? t("marketEntry.plan.notLinked") })}</span>
                <span aria-hidden="true">·</span>
                <span>{t("marketEntry.plan.updated", { date: dateTime(plan.updatedAt) })}</span>
                <span aria-hidden="true">·</span>
                <span>{t("marketEntry.plan.version", { version: plan.version })}</span>
              </div>
              {!plan.formationPlan && canLinkFormation && ["ASSESSING", "PAUSED"].includes(plan.status) ? (
                <form
                  className="action-control"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void linkFormationPlan(plan);
                  }}
                >
                  <label htmlFor={`formation-${plan.id}`}>{t("marketEntry.plan.linkExisting")}</label>
                  <select
                    id={`formation-${plan.id}`}
                    className="form-input"
                    value={selectedFormationPlans[plan.id] ?? ""}
                    disabled={busyId === plan.id}
                    onChange={(event) => setSelectedFormationPlans((current) => ({ ...current, [plan.id]: event.target.value }))}
                  >
                    <option value="">{t("marketEntry.plan.selectMatching")}</option>
                    {formationPlans.filter((candidate) =>
                      candidate.businessProfileId === plan.businessProfileId
                      && candidate.jurisdictionId === plan.targetJurisdictionId,
                    ).map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.status} · {candidate.id}</option>
                    ))}
                  </select>
                  <button className="button" type="submit" disabled={busyId === plan.id || !selectedFormationPlans[plan.id]}>{t("marketEntry.plan.link")}</button>
                </form>
              ) : null}

              {latest ? (
                <section className="space-y-3 border-t border-white/10 pt-4" aria-label={t("marketEntry.assessment.label")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{t(`marketEntry.readiness.${latest.resultJson.status}`)}</h4>
                      <p className="mt-1 text-xs text-slate-500">{t("marketEntry.assessment.assessed", { date: dateTime(latest.assessedAt) })}</p>
                    </div>
                    <span className={`status-badge ${latestAssessmentIsCurrent ? "status-neutral" : "status-warning"}`}>
                      {latestAssessmentIsCurrent ? t("marketEntry.assessment.current") : t("marketEntry.assessment.reassess")}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {latest.resultJson.checks.map((check) => {
                      const text = localizeReadinessCheck(t, check);
                      return (
                      <div className="rounded-lg border border-white/5 bg-black/10 p-3" key={check.key}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="text-xs font-semibold text-slate-200">{text.title}</h5>
                          <span className={`status-badge ${checkTone[check.status]}`}>{t(`marketEntry.check.${check.status}` as MessageKey)}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{text.summary}</p>
                        {text.nextSteps.map((step) => <p className="mt-2 text-xs leading-5 text-amber-100/80" key={step}>{t("marketEntry.assessment.next", { step })}</p>)}
                      </div>
                      );
                    })}
                  </div>
                  <p className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-3 text-xs leading-5 text-amber-100/80">{localizeReadinessBoundary(t, latest.resultJson.boundary)}</p>
                </section>
              ) : (
                <p className="border-t border-white/10 pt-4 text-xs text-slate-400">{t("marketEntry.assessment.none")}</p>
              )}

              {canManage || canReview ? (
                <div className="flex flex-wrap items-start gap-3 border-t border-white/10 pt-4">
                  {canManage ? (
                    <>
                      <button className="button" type="button" disabled={busyId === plan.id} onClick={() => void assessReadiness(plan)}>
                        <RefreshCw size={13} aria-hidden="true" /> {t("marketEntry.action.assess")}
                      </button>
                      {plan.status === "ASSESSING" || plan.status === "PAUSED" ? (
                        <button className="button" type="button" disabled={busyId === plan.id || plan.reviewStatus !== "APPROVED"} onClick={() => void updateStatus(plan, "IN_PROGRESS")}>
                          {t("marketEntry.action.start")}
                        </button>
                      ) : null}
                      {plan.status === "IN_PROGRESS" ? (
                        <>
                          <button className="button" type="button" disabled={busyId === plan.id} onClick={() => void updateStatus(plan, "PAUSED")}>{t("marketEntry.action.pause")}</button>
                          <button className="button" type="button" disabled={busyId === plan.id || plan.reviewStatus !== "APPROVED"} onClick={() => void updateStatus(plan, "COMPLETED")}>{t("marketEntry.action.complete")}</button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {canReview && plan.status !== "COMPLETED" ? (
                    <div className="action-control min-w-full">
                      <label htmlFor={`market-review-${plan.id}`}><ShieldCheck size={13} aria-hidden="true" /> {t("marketEntry.review.noteLabel")}</label>
                      {!latest ? <p className="w-full text-xs text-amber-100/80">{t("marketEntry.review.needAssessment")}</p> : null}
                      {latest && !latestAssessmentIsCurrent ? <p className="w-full text-xs text-amber-100/80">{t("marketEntry.review.stale")}</p> : null}
                      {latest?.status === "PREPARATION_INCOMPLETE" ? <p className="w-full text-xs text-amber-100/80">{t("marketEntry.review.incomplete")}</p> : null}
                      <textarea
                        id={`market-review-${plan.id}`}
                        className="form-input"
                        rows={2}
                        minLength={10}
                        maxLength={5000}
                        value={reviewNotes[plan.id] ?? ""}
                        onChange={(event) => setReviewNotes((current) => ({ ...current, [plan.id]: event.target.value }))}
                        placeholder={t("marketEntry.review.placeholder")}
                      />
                      <button className="button" type="button" disabled={busyId === plan.id || latest?.planVersion !== plan.version || !assessmentCanBeApproved} onClick={() => void reviewPlan(plan, "APPROVED")}>{t("marketEntry.review.record")}</button>
                      <button className="button" type="button" disabled={busyId === plan.id || latest?.planVersion !== plan.version} onClick={() => void reviewPlan(plan, "CHANGES_REQUESTED")}>{t("marketEntry.review.requestChanges")}</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
