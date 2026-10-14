// Canonical public origin. Unset means absolute URLs, sitemap and structured data are omitted rather than guessed.
export function getSiteUrl(): URL | null {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return new URL(url.origin);
  } catch {
    return null;
  }
}

// The only routes intended for search indexing; everything else is private or transactional.
export const INDEXABLE_PATHS = ["/", "/partners", "/faq"] as const;

export function publicPageMetadata(path: string) {
  const site = getSiteUrl();
  return {
    robots: { index: true, follow: true },
    ...(site ? { alternates: { canonical: new URL(path, site).toString() } } : {}),
  };
}
