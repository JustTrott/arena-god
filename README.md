# God Tracker

Arena God & ARAM challenge tracker for League of Legends. Started as a way for me and my friends to
track the Arena God achievement; it now also reads every Arena and ARAM challenge straight off your
account.

- **Arena Tracker** — one tile per champion, ticked when your match history shows a 1st place.
- **Challenges** — the Arena Brawler / Arena Champion groups, the full ARAM tree and the retired
  seasonal ARAM splits, with level, value, next threshold, percentile and leaderboard rank.
- **Match History / Stats / Live Game** — Arena 2v2 and 3v3 import, per-champion and duo stats, and a
  champ select helper.

Progress lives in `localStorage` (keys are still prefixed `arena-god-` so existing users keep their
data). There is no account and no server-side database.

### The two "God" challenges

| | Challenge | Rule |
| --- | --- | --- |
| Arena God | `602002` Adapt to All Situations | Place 1st in Arena with different champions |
| ARAM God | `101301` All Random All Champions | Earn an S- grade with different champions in ARAM |

ARAM's version needs a **grade**, not a win — and match-v5 returns no grade for ARAM games, so that
number can only be read from the challenge itself, never reconstructed per champion.

## Getting Started

1. Clone the repository:

```bash
git clone <repository-url>
cd god-tracker
```

2. Install dependencies using pnpm:

```bash
pnpm install
```

3. Create a `.env.local` file in the root directory with your Riot API key:

```bash
RIOT_API_TOKEN=your_riot_api_key_here
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NODE_ENV=development
```

`NEXT_PUBLIC_SITE_URL` is the canonical origin used for `metadataBase`, `sitemap.xml` and
`robots.txt`. Set it in production or canonical URLs and social previews point at the wrong host.

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

-   [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
-   [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
