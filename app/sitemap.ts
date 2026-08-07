import type { MetadataRoute } from "next";
import { flattenChallenges, getChallengeGroups } from "./lib/challenges";
import { LOCALES, Locale, localePath } from "./lib/i18n";
import { SITE_URL } from "./lib/site";

/** Same set of alternates Google expects next to every <url> entry. */
function alternates(path: string) {
	const languages: Record<string, string> = {};
	for (const locale of LOCALES) {
		languages[locale] = `${SITE_URL}${localePath(locale, path)}`;
	}
	return { languages };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const groups = await getChallengeGroups("en");
	const slugs = flattenChallenges(groups).map((def) => def.slug);
	const lastModified = new Date();

	const entries: MetadataRoute.Sitemap = [];

	for (const locale of LOCALES as readonly Locale[]) {
		entries.push({
			url: `${SITE_URL}${localePath(locale)}`,
			lastModified,
			changeFrequency: "daily",
			priority: locale === "en" ? 1 : 0.9,
			alternates: alternates(""),
		});
	}

	for (const slug of slugs) {
		for (const locale of LOCALES as readonly Locale[]) {
			const path = `challenge/${slug}`;
			entries.push({
				url: `${SITE_URL}${localePath(locale, path)}`,
				lastModified,
				changeFrequency: "monthly",
				priority: slug === "arena-god" || slug === "aram-god" ? 0.8 : 0.6,
				alternates: alternates(path),
			});
		}
	}

	return entries;
}
