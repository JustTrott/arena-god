import Link from "next/link";
import { Tabs } from "./tabs";
import { ChangelogPopup } from "./changelog-popup";
import { getImageTiles } from "../lib/images";
import { flattenChallenges, getChallengeGroups } from "../lib/challenges";
import { Locale, localePath, t } from "../lib/i18n";
import { SITE_NAME, SITE_URL } from "../lib/site";

function StructuredData({ locale }: { locale: Locale }) {
	const dict = t(locale);
	const url = `${SITE_URL}${localePath(locale)}`;
	const graph = [
		{
			"@type": "WebApplication",
			"@id": `${url}#app`,
			name: SITE_NAME,
			alternateName: ["Arena God Tracker", "ARAM God Tracker"],
			url,
			inLanguage: locale,
			applicationCategory: "GameApplication",
			operatingSystem: "Any",
			description: dict.metaDescription,
			offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
			featureList: dict.home.features,
			about: { "@type": "VideoGame", name: "League of Legends", publisher: "Riot Games" },
		},
		{
			"@type": "FAQPage",
			"@id": `${url}#faq`,
			inLanguage: locale,
			mainEntity: dict.faq.map((item) => ({
				"@type": "Question",
				name: item.question,
				acceptedAnswer: { "@type": "Answer", text: item.answer },
			})),
		},
	];

	return (
		<script
			type="application/ld+json"
			// Structured data has to be inline JSON; there is no React equivalent.
			dangerouslySetInnerHTML={{
				__html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
			}}
		/>
	);
}

export async function HomePage({ locale }: { locale: Locale }) {
	const dict = t(locale);
	const [images, challengeGroups] = await Promise.all([
		getImageTiles(),
		getChallengeGroups(locale),
	]);
	const all = flattenChallenges(challengeGroups);
	const otherLocale: Locale = locale === "de" ? "en" : "de";

	return (
		// The root layout's <html lang> is static, so each locale marks its own subtree.
		<div lang={locale} className="min-h-screen p-4">
			<StructuredData locale={locale} />

			<header className="max-w-3xl mx-auto text-center pt-6 pb-10">
				<h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{SITE_NAME}</h1>
				<p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{dict.tagline}</p>
				<p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
					{dict.intro(all.length > 0 ? String(all.length) : "")}
				</p>
				<Link
					href={localePath(otherLocale)}
					hrefLang={otherLocale}
					className="inline-block mt-4 text-xs text-blue-500 hover:underline"
				>
					{dict.home.languageNote}
				</Link>
			</header>

			<Tabs images={images} challengeGroups={challengeGroups} locale={locale} />

			<section className="max-w-3xl mx-auto mt-20 space-y-10 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
				<div className="space-y-3">
					<h2 className="text-xl font-bold text-gray-900 dark:text-white">
						{dict.home.explainTitle}
					</h2>
					{dict.home.explainParagraphs.map((paragraph) => (
						<p key={paragraph.slice(0, 40)}>{paragraph}</p>
					))}
				</div>

				<div className="space-y-3">
					<h2 className="text-xl font-bold text-gray-900 dark:text-white">
						{dict.home.featuresTitle}
					</h2>
					<ul className="space-y-2 list-disc pl-5">
						{dict.home.features.map((feature) => {
							const [lead, ...rest] = feature.split(" — ");
							return (
								<li key={feature.slice(0, 40)}>
									<strong>{lead}</strong>
									{rest.length > 0 ? ` — ${rest.join(" — ")}` : ""}
								</li>
							);
						})}
					</ul>
				</div>

				{all.length > 0 && (
					<div className="space-y-3">
						<h2 className="text-xl font-bold text-gray-900 dark:text-white">
							{t(locale).detail.allChallenges}
						</h2>
						<div className="flex flex-wrap gap-2">
							{all.map((def) => (
								<Link
									key={def.id}
									href={localePath(locale, `challenge/${def.slug}`)}
									className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/10 text-xs hover:border-blue-500 hover:text-blue-400 transition-colors"
								>
									{def.name}
								</Link>
							))}
						</div>
					</div>
				)}

				<div className="space-y-4">
					<h2 className="text-xl font-bold text-gray-900 dark:text-white">{dict.home.faqTitle}</h2>
					{dict.faq.map((item) => (
						<details
							key={item.question}
							className="rounded-lg border border-gray-200 dark:border-white/10 p-4"
						>
							<summary className="font-medium text-gray-900 dark:text-white cursor-pointer">
								{item.question}
							</summary>
							<p className="mt-2">{item.answer}</p>
						</details>
					))}
				</div>

				<p className="text-xs text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-white/10 pt-6">
					{dict.home.disclaimer}
				</p>
			</section>

			<ChangelogPopup />
		</div>
	);
}
