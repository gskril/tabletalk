# Tabletalk — product specification

## Product

An open, NYC-first social dining notebook powered by Flynet. Visitors can explore restaurants, read reviews and open a friend's list without an account. Members save places, rank meals, publish reviews, curate ordered lists and follow other diners. An independent product, not an official Blackbird or Beli client.

## Primary journeys and acceptance criteria

1. **Explore:** open directly onto NYC restaurant cards; search name/cuisine/neighborhood; filter neighborhood, cuisine, price and occasion; switch to a geographic map; open venue detail with address, external directions, photos and reviews. Empty search has a reset action.
2. **Join:** Connect with Blackbird uses server-side OAuth + PKCE. Public browsing never redirects to login. When credentials are absent, show that clearly and offer a separate demo account. Demo identity is unique to the browser session and never impersonates a real Blackbird member. Optional ChatGPT sign-in gives a durable identity independent of Blackbird.
3. **Collect:** authenticated visitor saves a restaurant to Want to try, removes it, reloads and retains the change. All authoritative records live in D1.
4. **Review/rank:** member writes a 1–10 score (one decimal), review, favorite dish and visit date. One review per member and venue; editing replaces it; deleting removes it from the feed and average. Personal rankings sort by rating. Verified visit badge is computed from imported member check-ins, never from a client flag. Demo reviews are labeled.
5. **Lists:** create a titled list with description, public/private visibility; add/remove places, reorder them, edit list details and delete own lists. Share a stable /lists/:id URL. Anonymous visitors can read public lists; private lists return 404 to others. Members can save someone else's public list and find it in My lists. Saves reference the original, so updates remain visible.
6. **Social:** public profiles, follow/unfollow, everyone/following activity feeds, likes on reviews. No Blackbird friend graph is invented; this social graph is app-owned.
7. **Passport:** explicit import of the connected member's dining history; check-ins remain private. User may choose to write public reviews afterwards. Show visited places and verify matching reviews. No automatic publication of raw visit timestamps.
8. **Resilience:** loading/error/empty states, retry, disabled repeat submits, persisted server writes, readable mobile layout, keyboard-operable dialogs and controls. Form input remains if saving fails.

## Visual direction

A lively neighborhood dining journal: white paper, ink typography, saturated tomato red, food photography, oversized editorial headings and compact practical controls. Horizontal top navigation, restaurant cards with strong photo crops, numbered list entries, small initials avatars. Explore is the working home screen, not a marketing landing page. Responsive cards and a simple mobile navigation.

## Routes

- `/`: explore; query parameters for search and filters.
- `/restaurants/:id`: venue and reviews.
- `/lists`: public lists; `/lists/:id`: shareable list detail.
- `/feed`: community / following activity.
- `/saved`: private Want to try, saved and owned lists.
- `/profile/:id`: public profile and rankings; `/me`: own passport and settings.
- `/about`: data provenance, demo limitations, integration status.
- `/api/state`: safe public records and caller-only private records.
- `/api/action`: validated authenticated state mutations.
- `/api/auth/blackbird/*`: OAuth start and callback; `/api/auth/demo`, `/api/auth/logout`.
- `/api/flynet/sync`: connected member check-ins; discovery refresh via configured backend.

## Data model

D1: profiles, sessions, OAuth pending states, venues, reviews, lists, ordered list items, saved lists, bookmarks, follows, review likes and private verified visits. UUID identifiers; foreign keys and uniqueness on relationship pairs; indexes for author/feed queries. Public DTOs exclude tokens, session hashes, email, external member IDs and private check-ins. OAuth tokens encrypted with a deployment secret; session cookie is HttpOnly, SameSite=Lax and Secure on HTTPS. Sessions stored by SHA-256 hash. Mutations require same-origin JSON requests and server ownership checks; schema validation constrains content and numeric values.

## Flynet integration

- Server-side `@flynetdev/core` Discovery with X-API-Key for locations/restaurants. Retain location ID as venue identity; brands can have multiple venues. NYC filtering happens on actual location address, not a nonexistent upstream `city` filter.
- OAuth scopes: `read:profile read:user_checkins` only. Client secret stays on server, with PKCE verifier and state bound to a short-lived browser cookie. Callback uses an exact registered URL.
- Member profile identity resolved through authenticated getProfile; never trust a decoded unsigned JWT as authentication.
- Check-ins fetched from member-scoped endpoint, paginated using nextPage; matching location IDs create private verification records. Public venue check-ins do not carry user identities and cannot establish who visited.
- Explicit environment configuration, staging by default. No silent switch from live errors to invented successful data.
- Provider API failures are surfaced without leaking secrets. Refresh credentials rotate. This MVP deliberately discards the refresh token and requests reconnect after the access token expires; the app notebook session lasts 30 days. This avoids refresh races and minimizes retained provider secrets.

## Demo policy

Curated sample venue catalog, editorial example lists, and fictional diner activity are marked demo. No claimed live Blackbird membership, availability, check-in, reward balance, or endorsement. Demo account data persists in D1 but the browser cookie is its only recovery mechanism; use a real account for cross-device ownership. Public URLs work across browsers. Production can turn demo account creation off.

## Scope boundary

This is a coherent hackathon MVP inspired by Beli, not an exact feature clone. No reservations engine, push notifications, direct messages, contact import, photo uploads, moderation console or payments in this version. Wallet/payment/reward APIs were researched; moving money is unnecessary to the core rating/list product. Future: collaborative lists, pairwise ranking, taste similarity after enough shared ratings, moderation, and opt-in FLY-funded dining experiences.

## Test plan

Real browser E2E on desktop and mobile: anonymous explore/search/filter/detail, demo join, bookmark persistence, create/reorder/share public list in second context, private-list isolation, review CRUD and scores, follow/feed/like, personal rankings, logout, empty/error states and keyboard dialogs. Server integration tests: unauthenticated rejection, cross-origin rejection, ownership/IDOR, validation boundaries, duplicate relationships, public DTO privacy. OAuth contract tests with mocked Flynet transport: PKCE/state/expiry/replay, token exchange, canonical member identity, failures and check-in verification. Live credential test remains explicitly pending until Blackbird provisions access.
