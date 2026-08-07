import type { Metadata } from "next";
import { LOCALES, Locale, localePath, t } from "./i18n";
import { SITE_NAME } from "./site";

const OG_LOCALE: Record<Locale, string> = { en: "en_US", de: "de_DE" };

/**
 * hreflang for every locale plus x-default. Next resolves these against metadataBase, so they must
 * stay relative — an absolute URL here would hardcode the wrong host in preview deployments.
 */
function languageAlternates(path: string) {
	const languages: Record<string, string> = {};
	for (const locale of LOCALES) {
		languages[locale] = localePath(locale, path);
	}
	languages["x-default"] = localePath("en", path);
	return languages;
}

export function localeMetadata(locale: Locale): Metadata {
	const dict = t(locale);
	const title = `${SITE_NAME} — ${dict.tagline}`;

	return {
		// Absolute: the root layout's "%s — God Tracker" template would double the site name here.
		title: { absolute: title },
		description: dict.metaDescription,
		keywords: dict.keywords,
		alternates: {
			canonical: localePath(locale),
			languages: languageAlternates(""),
		},
		openGraph: {
			type: "website",
			url: localePath(locale),
			siteName: SITE_NAME,
			title,
			description: dict.metaDescription,
			locale: OG_LOCALE[locale],
		},
		twitter: { card: "summary_large_image", title, description: dict.metaDescription },
	};
}

/** Detail-page metadata for one challenge. */
export function challengeMetadata(
	locale: Locale,
	challenge: { name: string; description: string; slug: string }
): Metadata {
	const dict = t(locale);
	const title = challenge.name;
	const description = dict.detail.metaDescription(challenge.name, challenge.description);
	const path = `challenge/${challenge.slug}`;

	return {
		title,
		description,
		alternates: {
			canonical: localePath(locale, path),
			languages: languageAlternates(path),
		},
		openGraph: {
			type: "article",
			url: localePath(locale, path),
			siteName: SITE_NAME,
			title: `${title} — ${SITE_NAME}`,
			description,
			locale: OG_LOCALE[locale],
		},
		twitter: { card: "summary_large_image", title, description },
	};
}
