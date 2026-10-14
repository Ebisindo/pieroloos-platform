import { describe, expect, it } from "vitest";
import { canTransitionExportInstitution, requiresWrittenEvidence } from "@/lib/domain/export-institution";
import { exportInstitutionCreateSchema, exportInstitutionStatusSchema } from "@/lib/validation/export-institution";

describe("global export institution validation", () => {
  it("defaults new institutions to prospective status at the API boundary", () => {
    const result = exportInstitutionCreateSchema.safeParse({
      officialName: "National Export Agency",
      category: "NATIONAL_EXPORT_PROMOTION",
      countryCode: "ng",
      initialEvidence: [],
    });
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
    if (result.success) expect(result.data.countryCode).toBe("NG");
  });

  it("rejects non-http institutional websites", () => {
    const result = exportInstitutionCreateSchema.safeParse({
      officialName: "National Export Agency",
      category: "NATIONAL_EXPORT_PROMOTION",
      officialWebsite: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields and malformed country codes", () => {
    expect(exportInstitutionCreateSchema.safeParse({
      officialName: "National Export Agency",
      category: "NATIONAL_EXPORT_PROMOTION",
      countryCode: "NGA",
      isConfirmedPartner: true,
    }).success).toBe(false);
  });

  it("requires a reason for status changes", () => {
    expect(exportInstitutionStatusSchema.safeParse({ status: "CONTACTED" }).success).toBe(false);
  });
});

describe("export institution relationship lifecycle", () => {
  it("starts prospectively and requires deliberate sequential progression", () => {
    expect(canTransitionExportInstitution("PROSPECTIVE_NOT_CONFIRMED", "RESEARCHING")).toBe(true);
    expect(canTransitionExportInstitution("PROSPECTIVE_NOT_CONFIRMED", "CONTACTED")).toBe(false);
  });

  it("does not permit activating an institution directly from draft terms", () => {
    expect(canTransitionExportInstitution("DRAFT_TERMS", "ACTIVE_UNDER_SIGNED_AGREEMENT")).toBe(false);
    expect(canTransitionExportInstitution("DRAFT_TERMS", "WRITTEN_AUTHORIZATION_VERIFIED")).toBe(true);
  });

  it("requires written evidence for authorization and active status", () => {
    expect(requiresWrittenEvidence("WRITTEN_AUTHORIZATION_VERIFIED")).toBe(true);
    expect(requiresWrittenEvidence("ACTIVE_UNDER_SIGNED_AGREEMENT")).toBe(true);
    expect(requiresWrittenEvidence("PROSPECTIVE_NOT_CONFIRMED")).toBe(false);
  });
});
