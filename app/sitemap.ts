import type { MetadataRoute } from "next";
import { getSiteUrl, INDEXABLE_PATHS } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  if (!site) return [];
  return INDEXABLE_PATHS.map((path) => ({ url: new URL(path, site).toString() }));
}
