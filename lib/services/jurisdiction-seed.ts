import type { Jurisdiction } from "@/lib/domain/jurisdiction";

export const authoritativeJurisdictionCoverage = [
  { code: "NG", name: "Nigeria", region: "West Africa", focus: ["company formation", "tax", "banking", "licensing"] },
  { code: "GH", name: "Ghana", region: "West Africa", focus: ["company formation", "tax", "data protection"] },
  { code: "KE", name: "Kenya", region: "East Africa", focus: ["company formation", "tax", "banking", "employment"] },
  { code: "RW", name: "Rwanda", region: "East Africa", focus: ["company formation", "tax", "data protection", "digital services"] },
  { code: "ZA", name: "South Africa", region: "Southern Africa", focus: ["company formation", "tax", "governance", "employment"] },
  { code: "CI", name: "Côte d’Ivoire", region: "West Africa", focus: ["company formation", "tax", "trade", "licensing"] },
] as const;

// Structural seed records only. Real claims must enter through verified evidence workflows.
export const jurisdictionSeed:Jurisdiction[]=[
{id:"us-new-mexico",code:"US-NM",name:"United States — New Mexico",region:"North America",profileSummary:"Structural record awaiting evidence-backed factor population.",factors:[]},
{id:"ng-nigeria",code:"NG",name:"Nigeria",region:"West Africa",profileSummary:"Structural record awaiting evidence-backed factor population.",factors:[]},
{id:"ae-uae",code:"AE",name:"United Arab Emirates",region:"Middle East",profileSummary:"Structural record awaiting evidence-backed factor population.",factors:[]},
];
