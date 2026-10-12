import type { Locale } from "./config";

type TargetLocale = Exclude<Locale, "en">;

export type GlossaryEntry = {
  id: string;
  /** English source term and a pattern that finds it in English catalog values. */
  source: string;
  sourcePattern: RegExp;
  /** Approved rendering per locale and a pattern that finds it in translated values. */
  preferred: Record<TargetLocale, string>;
  preferredPattern: Record<TargetLocale, RegExp>;
  /** Variants that must not be used for this concept (checked on values whose English contains the source term). */
  disallowed: Record<TargetLocale, RegExp>;
  note?: string;
};

/**
 * Controlled terminology for legally and operationally sensitive concepts.
 * Entries are a standardisation baseline, NOT a recorded legal or native-language review.
 * Review status is tracked in docs/INTERNATIONALIZATION.md and `GLOSSARY_REVIEW_STATUS`.
 */
export const GLOSSARY_REVIEW_STATUS = "unreviewed" as const;

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: "professionalReview",
    source: "professional review",
    sourcePattern: /professional review/i,
    preferred: { fr: "revue professionnelle", pt: "revisão profissional", es: "revisión profesional" },
    preferredPattern: { fr: /revue (par un )?professionnel/i, pt: /revisão (por um |de um )?profissional/i, es: /revisión (por un |de un )?profesional/i },
    disallowed: {
      fr: /examen professionnel|examen par un professionnel|vérification professionnelle/i,
      pt: /análise profissional|avaliação profissional|verificação profissional/i,
      es: /examen profesional|validación profesional|verificación profesional/i,
    },
    note: "Human review by a qualified professional; never a government or regulatory approval.",
  },
  {
    id: "jurisdiction",
    source: "jurisdiction",
    sourcePattern: /jurisdiction/i,
    preferred: { fr: "juridiction", pt: "jurisdição", es: "jurisdicción" },
    preferredPattern: { fr: /juridiction/i, pt: /jurisdi[cç]/i, es: /jurisdicci/i },
    disallowed: { fr: /territoire/i, pt: /território/i, es: /territorio/i },
  },
  {
    id: "obligation",
    source: "obligation",
    sourcePattern: /obligation/i,
    preferred: { fr: "obligation", pt: "obrigação", es: "obligación" },
    preferredPattern: { fr: /obligation/i, pt: /obrigaç/i, es: /obligaci/i },
    disallowed: { fr: /exigence de conformité/i, pt: /requisito de conformidade/i, es: /requisito de cumplimiento/i },
    note: "A signal is an observation, not an obligation; do not use obligation for signals.",
  },
  {
    id: "evidence",
    source: "evidence",
    sourcePattern: /evidence/i,
    preferred: { fr: "preuve", pt: "evidência", es: "evidencia" },
    preferredPattern: { fr: /preuve/i, pt: /evidência/i, es: /evidencia/i },
    disallowed: { fr: /éléments? probants?|justificatifs?(?! )/i, pt: /comprovativo|comprovante/i, es: /justificante/i },
    note: "'Supporting document' is a separate term (document justificatif / documento comprovativo / documento justificativo).",
  },
  {
    id: "compliance",
    source: "compliance",
    sourcePattern: /compliance/i,
    preferred: { fr: "conformité", pt: "conformidade", es: "cumplimiento" },
    preferredPattern: { fr: /conformité/i, pt: /conformidade/i, es: /cumplimiento/i },
    disallowed: { fr: /\bcompliance\b/i, pt: /\bcompliance\b/i, es: /\bcompliance\b/i },
  },
  {
    id: "formationRoadmap",
    source: "formation roadmap",
    sourcePattern: /formation roadmap/i,
    preferred: { fr: "feuille de route", pt: "roteiro", es: "hoja de ruta" },
    preferredPattern: { fr: /feuille de route/i, pt: /roteiro/i, es: /hoja de ruta/i },
    disallowed: { fr: /calendrier de constitution/i, pt: /cronograma de constituição/i, es: /cronograma de constitución/i },
  },
  {
    id: "crossBorder",
    source: "cross-border",
    sourcePattern: /cross-border/i,
    preferred: { fr: "transfrontalier", pt: "transfronteiriço", es: "transfronterizo" },
    preferredPattern: { fr: /transfrontalier/i, pt: /transfronteiri/i, es: /transfronteriz/i },
    disallowed: { fr: /\bcross-border\b/i, pt: /\bcross-border\b/i, es: /\bcross-border\b/i },
  },
];
