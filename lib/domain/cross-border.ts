export type CrossBorderReviewControl = {
  status: string;
  requiresEvidence: boolean;
  evidenceCount: number;
};

export function isCrossBorderDossierReadyForReview(controls: CrossBorderReviewControl[]) {
  return controls.length > 0 && controls.every((control) =>
    control.status === "NOT_APPLICABLE"
    || (control.status === "COMPLETE" && (!control.requiresEvidence || control.evidenceCount > 0)),
  );
}
