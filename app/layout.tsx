import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PostHogProvider } from "./providers";
import { SITE_NAME, SITE_URL } from "./lib/site";
import { DEFAULT_LOCALE, t } from "./lib/i18n";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

// Per-page metadata (title, description, canonical, hreflang) comes from lib/metadata.ts. Only the
// values that are identical on every page live here.
export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: `${SITE_NAME} — ${t(DEFAULT_LOCALE).tagline}`,
		template: `%s — ${SITE_NAME}`,
	},
	description: t(DEFAULT_LOCALE).metaDescription,
	applicationName: SITE_NAME,
	robots: {
		index: true,
		follow: true,
		googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
	},
	category: "games",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<PostHogProvider>{children}</PostHogProvider>
			</body>
		</html>
	);
}
