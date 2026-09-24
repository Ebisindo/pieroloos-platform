import { describe, expect, it } from "vitest";
import { generateObligationsFromRules } from "@/lib/services/compliance-engine";

describe("compliance engine",()=>{
  it("generates jurisdiction-scoped obligations and deadlines",()=>{
    const result=generateObligationsFromRules([{
      id:"rule-1",version:"1.0",jurisdictionId:"jur-1",title:"Annual filing",
      type:"ANNUAL_FILING",relativeDueDays:30,professionalReviewRequired:false,
      requiredEvidence:true,active:true
    }],{jurisdictionId:"jur-1",formationCompletedAt:new Date("2026-01-01T00:00:00Z")});
    expect(result).toHaveLength(1);
    expect(result[0].dueAt?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(result[0].evidenceRequired).toBe(true);
  });
});
