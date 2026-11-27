import type { MetadataRoute } from "next";
import { industrySlugs } from "@/components/marketing/industry-content";
import { indexableSite, siteOrigin } from "./site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!indexableSite || !siteOrigin) return [];
  return ["/", ...industrySlugs.map((slug) => `/solutions/${slug}`)].map((path) => ({
    url: new URL(path, siteOrigin).href,
  }));
}
