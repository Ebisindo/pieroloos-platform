import type { EvidenceClass } from "@/lib/domain/jurisdiction";
const labels:Record<EvidenceClass,string>={E0:"UNKNOWN",E1:"USER PROVIDED",E2:"SECONDARY",E3:"PRIMARY",E4:"CROSS-VERIFIED"};
export function EvidenceBadge({evidenceClass}:{evidenceClass:EvidenceClass}){return <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tracking-[0.16em] text-slate-300">{evidenceClass} · {labels[evidenceClass]}</span>;}
