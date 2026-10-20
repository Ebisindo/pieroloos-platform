export interface ReportSection {
  id: string;
  title: string;
  content: string;
  evidenceIds?: string[];
}

export interface ReportDocument {
  title: string;
  clientId: string;
  generatedAt: string;
  sections: ReportSection[];
  disclaimer: string;
}

export const DEFAULT_REPORT_DISCLAIMER = "PieroloOS provides structured information, analysis and workflow support. It does not replace legal, tax, accounting, regulatory, financial or other professional advice.";
