import { ImageResponse } from "next/og";
import { SITE_NAME } from "./lib/site";
import { DEFAULT_LOCALE, t } from "./lib/i18n";

const SITE_TAGLINE = t(DEFAULT_LOCALE).tagline;

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// No external fonts or images: the CSP-free default sans is enough, and a fetch here would make
// social previews depend on a third party being up.
export default function OpengraphImage() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					background: "linear-gradient(135deg, #0b1120 0%, #111827 55%, #1e2a4a 100%)",
					color: "white",
					padding: 80,
				}}
			>
				<div style={{ fontSize: 116, fontWeight: 800, letterSpacing: -4 }}>{SITE_NAME}</div>
				<div style={{ fontSize: 40, color: "#93c5fd", marginTop: 12, textAlign: "center" }}>
					{SITE_TAGLINE}
				</div>
				<div style={{ display: "flex", gap: 20, marginTop: 56 }}>
					{["Arena God checklist", "All Arena + ARAM challenges", "No login"].map((label) => (
						<div
							key={label}
							style={{
								fontSize: 26,
								color: "#cbd5e1",
								border: "2px solid #334155",
								borderRadius: 999,
								padding: "12px 28px",
							}}
						>
							{label}
						</div>
					))}
				</div>
			</div>
		),
		size
	);
}
