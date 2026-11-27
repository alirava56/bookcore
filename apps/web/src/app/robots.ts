import type { MetadataRoute } from "next";
import { indexableSite, siteOrigin } from "./site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: indexableSite && siteOrigin ? new URL("/sitemap.xml", siteOrigin).href : undefined,
  };
}
