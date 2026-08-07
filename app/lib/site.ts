/**
 * Canonical origin, used for metadataBase, sitemap and robots. Set NEXT_PUBLIC_SITE_URL in the
 * deployment env — a wrong origin here silently breaks canonical URLs and OG previews.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://god-tracker.org").replace(/\/$/, "");

export const SITE_NAME = "God Tracker";
