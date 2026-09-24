import type { Jurisdiction } from "@/lib/domain/jurisdiction";
// Structural seed records only. Real claims must enter through verified evidence workflows.
export const jurisdictionSeed:Jurisdiction[]=[
{id:"us-new-mexico",code:"US-NM",name:"United States — New Mexico",region:"North America",profileSummary:"Structural record awaiting evidence-backed factor population.",factors:[]},
{id:"ng-nigeria",code:"NG",name:"Nigeria",region:"West Africa",profileSummary:"Structural record awaiting evidence-backed factor population.",factors:[]},
{id:"ae-uae",code:"AE",name:"United Arab Emirates",region:"Middle East",profileSummary:"Structural record awaiting evidence-backed factor population.",factors:[]},
];
