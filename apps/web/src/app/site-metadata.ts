function getSiteOrigin() {
  const value = process.env.VAGHTIMO_SITE_URL;
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".") &&
        !/^(?:\d+\.){3}\d+$/.test(url.hostname) && !url.hostname.endsWith(".localhost")) {
      return new URL(url.origin);
    }
  } catch {
    return undefined;
  }
}

export const siteOrigin = getSiteOrigin();
export const indexableSite = process.env.NODE_ENV === "production" &&
  process.env.VAGHTIMO_INDEXABLE === "1" && Boolean(siteOrigin);
