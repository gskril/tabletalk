# Tabletalk

An open NYC dining notebook built for Runtime's Blackbird / Flynet track. Browse restaurants, map a meal, write reviews, rank your favorites, follow diners, and share public lists without a login wall.

## What works
- NYC restaurant discovery with search, cuisine/neighborhood/price/occasion filters and a zoomable OpenStreetMap view.
- Restaurant pages, directions, review creation/edit/delete, 1–10 ratings and personal rankings.
- Ordered public/private lists, edits, sharing, saving other people's lists, and a personal Want to try collection.
- Public profiles, follows, community/following feeds and review likes.
- D1 persistence, isolated demo accounts, optional platform sign-in and real Blackbird OAuth integration.
- Official `@flynetdev/core` discovery and member check-in adapters, encrypted provider tokens, PKCE/state/replay protections, private check-in imports and verified-review badges.

## Important status
The default catalog and fictional diners are labeled demo. Credentials were not supplied, so live Blackbird sign-in, discovery and import have **not** been tested against a provisioned Blackbird account. Controlled contract tests cover the actual callback and sync handlers with the installed SDK. A working demo is not evidence of hackathon API eligibility; finish the live smoke test once access arrives.

A demo account is identified by a 30-day HttpOnly browser cookie. It persists across reloads, but cannot be recovered on another device or after sign-out. Public lists are readable across browsers. Use Blackbird or platform sign-in for recoverable identity.

## Develop
Requires Node 22.13+ (Node 24 for the SQLite-backed contract tests).

```sh
npm ci
cp .env.example .env
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_even_penance.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_handy_frog_thor.sql
npm run dev -- --port 5173
```

Apply each migration only once to a given local database. The development server prints its URL (normally `http://localhost:5173`). Local platform sign-in is simulated by the starter; hosted sign-in is handled by Sites.

```sh
npm run typecheck
npm run test:contract
npx playwright install chromium
npm run test:e2e
```

The Playwright suite expects the dev server to be running. It creates records only in the local database. Do not run its mutation journeys against production. Screenshots and traces are in ignored `test-results/`; the HTML report is in ignored `playwright-report/`.

## Connect Blackbird
See [integration setup](docs/INTEGRATION.md). Configure all variables in `.env.example`; keep real values out of source control. Hosted variables belong in Sites environment settings. API keys and secrets are never shipped to the client.

## Design and research
- [Detailed product spec](docs/SPEC.md)
- [Blackbird research and source links](docs/RESEARCH.md)
- [Exact official track description](docs/blackbird-track.json)
- [Demo and submission guide](docs/DEMO.md)
- [Validation report](docs/TESTING.md)

## Architecture
React + TypeScript on Vinext, Cloudflare Workers, D1/SQLite with Drizzle schema migrations; Radix-backed UI primitives; official Flynet SDK; Leaflet/OpenStreetMap; Playwright. App-specific code lives in `components/tabletalk.tsx`, `lib/`, and `app/api/`. All writes are validated and authorized server-side. Public responses exclude email, external member IDs, tokens and private records.

## MVP limits
No photo uploads, direct messages, push notifications, collaborative list editing, restaurant reservations, payment/reward transactions, or production moderation console. Review scores are simple arithmetic ratings, not Beli's proprietary ranking algorithm. This is a small hackathon deployment; the state endpoint is designed for a modest catalog and community, not an unbounded production dataset. Public demo creation and writes have server-side rate limits; disable `DEMO_ENABLED` for a real community launch.

Photo copyrights remain with the credited restaurants. Source code uses an independent product identity; no Blackbird or Beli affiliation is claimed.
