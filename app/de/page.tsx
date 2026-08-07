import type { Metadata } from "next";
import { HomePage } from "../components/home-page";
import { localeMetadata } from "../lib/metadata";

export const revalidate = 3600;

export const metadata: Metadata = localeMetadata("de");

export default function Page() {
	return <HomePage locale="de" />;
}
