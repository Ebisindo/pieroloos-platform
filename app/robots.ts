import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      // Public draft legal pages are crawlable so crawlers can see their noindex metadata.
      // They remain excluded from INDEXABLE_PATHS and the sitemap until approved.
      allow: ["/$", "/partners", "/faq", "/terms", "/policies", "/policies/"],
      disallow: ["/", "/api/", "/admin/", "/portal", "/signin", "/clients", "/command-center", "/settings"],
    },
    ...(site ? { sitemap: new URL("/sitemap.xml", site).toString() } : {}),
  };
}
