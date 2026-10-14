export type FaqQuestion = readonly [question: string, answer: string];

/**
 * Serializes the FAQ content for an application/ld+json script element.
 * Escaping "<" prevents user-controlled or future FAQ text from closing
 * the script element while preserving valid JSON-LD semantics.
 */
export function serializeFaqJsonLd(questions: readonly FaqQuestion[]): string {
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  });

  return json.replace(/</g, "\\u003c");
}
