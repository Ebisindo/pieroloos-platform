import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/partners", "/faq"],
      disallow: ["/", "/api/", "/admin/", "/portal", "/signin", "/clients", "/command-center", "/settings", "/terms", "/policies"],
    },
    ...(site ? { sitemap: new URL("/sitemap.xml", site).toString() } : {}),
  };
}
