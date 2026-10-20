import { DEFAULT_REPORT_DISCLAIMER, type ReportDocument } from "../domain/report";

export function createReportDocument(input: Omit<ReportDocument, "generatedAt" | "disclaimer"> & { disclaimer?: string }): ReportDocument {
  return {
    ...input,
    generatedAt: new Date().toISOString(),
    disclaimer: input.disclaimer ?? DEFAULT_REPORT_DISCLAIMER,
  };
}
