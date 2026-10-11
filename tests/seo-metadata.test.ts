import { afterEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getSiteUrl, INDEXABLE_PATHS, publicPageMetadata } from "@/lib/site";

const original = process.env.SITE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = original;
});

describe("site URL handling", () => {
  it("returns null when unset or invalid and strips paths from valid values", () => {
    delete process.env.SITE_URL;
    expect(getSiteUrl()).toBeNull();
    process.env.SITE_URL = "javascript:alert(1)";
    expect(getSiteUrl()).toBeNull();
    process.env.SITE_URL = "not a url";
    expect(getSiteUrl()).toBeNull();
    process.env.SITE_URL = "https://example.com/some/path?x=1";
    expect(getSiteUrl()?.toString()).toBe("https://example.com/");
  });

  it("only sets a canonical URL when the site URL is configured", () => {
    delete process.env.SITE_URL;
    expect(publicPageMetadata("/partners")).toEqual({ robots: { index: true, follow: true } });
    process.env.SITE_URL = "https://example.com";
    expect(publicPageMetadata("/partners").alternates?.canonical).toBe("https://example.com/partners");
  });
});

describe("sitemap and robots", () => {
  it("lists only public marketing routes", () => {
    process.env.SITE_URL = "https://example.com";
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(INDEXABLE_PATHS.map((path) => new URL(path, "https://example.com").toString()));
    for (const privatePath of ["/clients", "/command-center", "/portal", "/settings", "/api", "/signin"]) {
      expect(urls.some((url) => url.includes(privatePath))).toBe(false);
    }
  });

  it("emits an empty sitemap rather than guessing an origin", () => {
    delete process.env.SITE_URL;
    expect(sitemap()).toEqual([]);
    expect(robots().sitemap).toBeUndefined();
  });

  it("disallows everything except the public routes", () => {
    process.env.SITE_URL = "https://example.com";
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: ["/$", "/partners"], disallow: "/" });
    expect(result.sitemap).toBe("https://example.com/sitemap.xml");
  });
});
