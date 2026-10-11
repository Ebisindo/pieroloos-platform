import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: { userAgent: "*", allow: ["/$", "/partners"], disallow: "/" },
    ...(site ? { sitemap: new URL("/sitemap.xml", site).toString() } : {}),
  };
}
