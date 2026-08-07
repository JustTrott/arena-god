import type { Metadata } from "next";
import { HomePage } from "./components/home-page";
import { localeMetadata } from "./lib/metadata";

// The champion list and the challenge config both revalidate hourly upstream; keeping the page
// itself static-with-revalidate is what puts the challenge names in the crawled HTML.
export const revalidate = 3600;

export const metadata: Metadata = localeMetadata("en");

export default function Page() {
	return <HomePage locale="en" />;
}
