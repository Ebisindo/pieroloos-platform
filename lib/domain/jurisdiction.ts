export const EVIDENCE_CLASSES = ["E0", "E1", "E2", "E3", "E4"] as const;
export type EvidenceClass = typeof EVIDENCE_CLASSES[number];
export type JurisdictionFactor = { criterionKey:string; value:number|string|boolean|null; normalizedScore?:number|null; evidenceClass:EvidenceClass; sourceIds:string[]; confidence:number; reviewRequired:boolean; notes?:string };
export type Jurisdiction = { id:string; code:string; name:string; region?:string; profileSummary?:string; factors:JurisdictionFactor[] };
export type ComparisonCriterion = { key:string; name:string; description:string; weight:number };
export const EVIDENCE_CONFIDENCE: Record<EvidenceClass,number> = { E0:0,E1:25,E2:50,E3:75,E4:100 };
export function evidenceConfidence(c:EvidenceClass){return EVIDENCE_CONFIDENCE[c];}
export function normalizeWeights(criteria:ComparisonCriterion[]){const total=criteria.reduce((s,c)=>s+c.weight,0); if(total<=0)return criteria.map(c=>({...c,normalizedWeight:0})); return criteria.map(c=>({...c,normalizedWeight:c.weight/total}));}
export function calculateAnalyticalIndicator(factors:JurisdictionFactor[],criteria:ComparisonCriterion[]){const cs=normalizeWeights(criteria);let total=0,known=0;for(const c of cs){const f=factors.find(x=>x.criterionKey===c.key);if(!f||f.normalizedScore==null)continue;total+=f.normalizedScore*c.normalizedWeight;known+=c.normalizedWeight;}return known===0?null:Number((total/known).toFixed(2));}
export function calculateConfidence(factors:JurisdictionFactor[]){if(!factors.length)return 0;return Math.round(factors.reduce((s,f)=>s+f.confidence,0)/factors.length);}
