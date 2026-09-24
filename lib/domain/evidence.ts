import type { EvidenceClass } from "@/lib/domain/jurisdiction";
export type EvidenceRecord={id:string;title:string;sourceType:string;sourceUrl?:string;publicationDate?:string;retrievedAt:string;evidenceClass:EvidenceClass;reviewStatus:"UNREVIEWED"|"REVIEWED"|"EXPIRED";notes?:string};
export function requiresProfessionalReview(input:{evidenceClass:EvidenceClass;reviewStatus:EvidenceRecord["reviewStatus"]}){return input.evidenceClass==="E0"||input.reviewStatus!=="REVIEWED";}
