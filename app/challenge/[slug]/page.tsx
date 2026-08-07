import type { Metadata } from "next";
import { ChallengeDetail, challengeSlugs, getChallenge } from "../../components/challenge-detail";
import { challengeMetadata } from "../../lib/metadata";

export const revalidate = 3600;

export async function generateStaticParams() {
	return challengeSlugs();
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const { hit } = await getChallenge("en", slug);
	if (!hit) return {};
	return challengeMetadata("en", hit.def);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	return <ChallengeDetail locale="en" slug={slug} />;
}
