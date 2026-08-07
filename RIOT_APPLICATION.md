# Riot API production key application

Copy-paste text for the "Product Description" field. Keep it in sync with what the app actually
does — the reviewer checks the live site against this text.

---

## Product Description

God Tracker (https://god-tracker.org) is a free, no-login progress tracker for League of Legends
players working on the Arena God title and the ARAM challenges. Players enter their Riot ID, and the
site imports their Arena match history to build a champion-by-champion checklist: one tile per
champion, ticked off as soon as a 1st place placement is found, with a progress bar toward the
"Adapt to All Situations" challenge levels. A Challenges tab reads every Arena and ARAM challenge
from the player's account and shows the current level, value, next threshold, percentile and
leaderboard rank, so a player can see at a glance what is left to do. A stats view derives per
champion win rates, first-try wins, champions never won on, and duo partner win rates from the same
imported matches, and every challenge also has its own page listing all levels and thresholds.

The APIs we are using are: account (Riot ID to PUUID lookup), match (Arena match IDs and match
details for queues 1700 and 1750), challenges (challenge config plus per-player challenge data), and
spectator (to detect a game in progress and highlight the champions the player still needs during
champ select). Champion names, icons and roles come from Data Dragon.

There is no account system and no server-side database: a player's Riot ID, imported matches and
champion progress are stored only in their own browser's local storage, and match details are cached
there so a re-sync only requests matches it has not seen. Requests to Riot are made server-side with
a single API key, rate limited to roughly one request per 1.2 seconds with exponential backoff on
429s. The site is free, has no ads and no companion mobile app. We use PostHog for anonymous product
analytics only.

---

## Endpoints used

| Endpoint | Purpose |
| --- | --- |
| `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` | Resolve a Riot ID to a PUUID |
| `/lol/match/v5/matches/by-puuid/{puuid}/ids?queue=1700\|1750` | List the player's Arena matches |
| `/lol/match/v5/matches/{matchId}` | Champion, placement and teammates per match |
| `/lol/challenges/v1/challenges/config` | Challenge names, descriptions and thresholds (cached 24h) |
| `/lol/challenges/v1/player-data/{puuid}` | The player's level and value per challenge |
| `/lol/spectator/v5/active-games/by-summoner/{puuid}` | Detect a live game / champ select |

Data Dragon (`ddragon.leagueoflegends.com`) supplies champion ids, names, icons and roles.

## Things to disclose if asked

- **Local League Client (LCU) read access.** When the app runs on the same machine as the League
  client, one optional route reads champ select state from the client's own loopback API using the
  lockfile, read-only, to show the champion grid during pick. This cannot work on the hosted site and
  is only active for players running the app locally. Remove `app/api/champ-select/route.ts` if this
  is unwanted in the reviewed product.
- **Third-party stats.** Arena 1st-place rates and build/augment suggestions come from Blitz's public
  backend (`data.v2.iesdev.com`), not from the Riot API. Every failure there degrades to "no stats"
  rather than breaking the page.
