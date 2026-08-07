import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Trophy } from "lucide-react";
import {
	ChallengeGroup,
	LEVEL_STYLES,
	findBySlug,
	getChallengeGroups,
} from "../lib/challenges";
import { Locale, localePath, t } from "../lib/i18n";
import { SITE_NAME, SITE_URL } from "../lib/site";

/** Both locale routes prerender from the same slug list. */
export async function challengeSlugs(): Promise<{ slug: string }[]> {
	const groups = await getChallengeGroups("en");
	return groups
		.flatMap((g) => [...(g.parent ? [g.parent] : []), ...g.challenges])
		.map((def) => ({ slug: def.slug }));
}

export async function getChallenge(locale: Locale, slug: string) {
	const groups = await getChallengeGroups(locale);
	return { groups, hit: findBySlug(groups, slug) };
}

function Breadcrumbs({ locale, group, name }: { locale: Locale; group: ChallengeGroup; name: string }) {
	const dict = t(locale);
	return (
		<nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
			<Link href={localePath(locale)} className="hover:text-blue-400">
				{dict.detail.breadcrumbHome}
			</Link>
			<ChevronRight className="w-3 h-3" />
			<span>{group.name}</span>
			<ChevronRight className="w-3 h-3" />
			<span className="text-gray-400">{name}</span>
		</nav>
	);
}

export async function ChallengeDetail({ locale, slug }: { locale: Locale; slug: string }) {
	const dict = t(locale);
	const { hit } = await getChallenge(locale, slug);
	if (!hit) notFound();

	const { def, group } = hit;
	const top = def.thresholds[def.thresholds.length - 1];
	const siblings = [...(group.parent ? [group.parent] : []), ...group.challenges].filter(
		(d) => d.slug !== def.slug
	);
	const otherLocale: Locale = locale === "de" ? "en" : "de";
	const path = `challenge/${def.slug}`;

	const breadcrumbLd = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: SITE_NAME,
				item: `${SITE_URL}${localePath(locale)}`,
			},
			{ "@type": "ListItem", position: 2, name: group.name },
			{
				"@type": "ListItem",
				position: 3,
				name: def.name,
				item: `${SITE_URL}${localePath(locale, path)}`,
			},
		],
	};

	return (
		<div lang={locale} className="min-h-screen p-4">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
			/>

			<article className="max-w-2xl mx-auto pt-8 pb-16 space-y-8">
				<Breadcrumbs locale={locale} group={group} name={def.name} />

				<header className="space-y-3">
					<h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{def.name}</h1>
					<p className="text-base text-gray-600 dark:text-gray-300">{def.description}</p>
					<dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 pt-1">
						<div className="flex gap-1.5">
							<dt>{dict.detail.groupLabel}:</dt>
							<dd className="text-gray-400">{group.name}</dd>
						</div>
						<div className="flex gap-1.5">
							<dt>{dict.detail.idLabel}:</dt>
							<dd className="font-mono text-gray-400">{def.id}</dd>
						</div>
						{top && (
							<div className="flex gap-1.5">
								<dt>{dict.detail.maxLabel}:</dt>
								<dd className="text-gray-400">
									{top.level.toLowerCase()} &middot; {top.value.toLocaleString("en-US")}
								</dd>
							</div>
						)}
					</dl>
				</header>

				{def.thresholds.length > 0 && (
					<section className="space-y-3">
						<h2 className="text-lg font-semibold">{dict.detail.levelTableTitle}</h2>
						<div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
							<table className="w-full text-sm">
								<thead>
									<tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 dark:border-white/10">
										<th className="px-4 py-2 font-medium">{dict.detail.levelColumn}</th>
										<th className="px-4 py-2 font-medium text-right">
											{dict.detail.requiredColumn}
										</th>
									</tr>
								</thead>
								<tbody>
									{def.thresholds.map((threshold) => (
										<tr
											key={threshold.level}
											className="border-b last:border-0 border-gray-100 dark:border-white/5"
										>
											<td className="px-4 py-2">
												<span
													className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
														LEVEL_STYLES[threshold.level] || LEVEL_STYLES.NONE
													}`}
												>
													{threshold.level}
												</span>
											</td>
											<td className="px-4 py-2 text-right font-mono">
												{threshold.value.toLocaleString("en-US")}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{def.leaderboard && (
							<p className="text-xs text-gray-500">{dict.detail.leaderboardNote}</p>
						)}
					</section>
				)}

				<section className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-3">
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<Trophy className="w-4 h-4 text-yellow-400" />
						{dict.detail.howToTitle}
					</h2>
					<p className="text-sm text-gray-600 dark:text-gray-300">{dict.detail.howToBody}</p>
					<Link
						href={localePath(locale)}
						className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
					>
						{dict.detail.openTracker}
					</Link>
				</section>

				{siblings.length > 0 && (
					<section className="space-y-3">
						<h2 className="text-lg font-semibold">{dict.detail.siblingsTitle(group.name)}</h2>
						<ul className="space-y-1.5">
							{siblings.map((sibling) => (
								<li key={sibling.id}>
									<Link
										href={localePath(locale, `challenge/${sibling.slug}`)}
										className="text-sm text-blue-400 hover:underline"
									>
										{sibling.name}
									</Link>
									<span className="text-xs text-gray-500"> — {sibling.shortDescription}</span>
								</li>
							))}
						</ul>
					</section>
				)}

				<div className="flex gap-4 text-xs text-gray-500 border-t border-gray-200 dark:border-white/10 pt-6">
					<Link href={localePath(locale)} className="hover:text-blue-400">
						{dict.detail.allChallenges}
					</Link>
					<Link
						href={localePath(otherLocale, path)}
						hrefLang={otherLocale}
						className="hover:text-blue-400"
					>
						{dict.home.languageNote}
					</Link>
				</div>
			</article>
		</div>
	);
}
