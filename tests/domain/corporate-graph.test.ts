import { describe,expect,it } from "vitest";
import { assessComplianceRule,validateGraphEdge,wouldCreateOwnershipCycle } from "@/lib/domain/corporate-graph";
import type { CorporateGraphRelationType } from "@prisma/client";
describe("corporate graph guardrails",()=>{
 it("rejects self relationships",()=>expect(validateGraphEdge({fromNodeId:"a",toNodeId:"a",relation:"OWNS"})).toContain("cannot be related"));
 it("rejects invalid ownership percentages",()=>expect(validateGraphEdge({fromNodeId:"a",toNodeId:"b",relation:"OWNS",ownershipPercent:101})).toContain("between 0 and 100"));
 it("detects cycles",()=>{const edges:Array<{fromNodeId:string;toNodeId:string;relation:CorporateGraphRelationType}>=[{fromNodeId:"a",toNodeId:"b",relation:"OWNS"},{fromNodeId:"b",toNodeId:"c",relation:"OWNS"}];expect(wouldCreateOwnershipCycle(edges,{fromNodeId:"c",toNodeId:"a",relation:"OWNS"})).toBe(true);});
 it("ignores non ownership links for cycle checks",()=>expect(wouldCreateOwnershipCycle([],{fromNodeId:"a",toNodeId:"b",relation:"BANKS_WITH"})).toBe(false));
});
describe("evidence governed compliance assessment",()=>{
 const base={id:"r1",jurisdictionCode:"NG",entityType:"COMPANY",ruleKey:"example",title:"Illustrative rule",description:null,frequency:null,severity:"MEDIUM",sourceTitle:"Official source",sourceUrl:"https://example.gov",sourceAuthority:"Authority",sourceRetrievedAt:new Date("2026-01-01T00:00:00.000Z"),effectiveFrom:new Date("2025-01-01T00:00:00.000Z"),effectiveTo:null,evidenceClass:"E3" as const,reviewStatus:"VERIFIED" as const,requiresProfessionalReview:false,active:true,version:1};
 it("recognises complete evidence metadata",()=>{const r=assessComplianceRule(base,new Date("2026-10-01T00:00:00.000Z"));expect(r.sourceReady).toBe(true);expect(r.professionalReviewRequired).toBe(false);});
 it("requires review when source is not verified",()=>{const r=assessComplianceRule({...base,reviewStatus:"UNREVIEWED"},new Date("2026-10-01T00:00:00.000Z"));expect(r.sourceReady).toBe(false);expect(r.professionalReviewRequired).toBe(true);expect(r.gaps).toContain("SOURCE_NOT_VERIFIED");});
});
