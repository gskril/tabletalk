# Flynet response audit — September 15, 2026

## Scope and confidence
Reviewed the installed official `@flynetdev/core` **0.8.1** implementation, generated inbound schemas, and current official member, location, authentication and pagination documentation. The lockfile fixes the tested dependency version. Fixtures exercise the real SDK parser and actual application handlers; only the upstream HTTP responses and local database adapter are controlled.

Production Discovery is now verified with issued credentials: all 34 pages (1,675 locations, including 808 matching the app's NYC filter) parsed successfully through SDK 0.8.1. The same key was rejected by staging, confirming it must use production. The public database now populates automatically through the shared catalog cache. Real token exchange, canonical member profile creation, and a complete automatic private history import are confirmed in production. No real member review has been published; review authorization and create/edit behavior are covered by controlled integration and browser tests.

The production OAuth gateway accepted a PKCE authorization request without `audience` and redirected to `passport.flynet.org`. The current official OAuth guide also omits audience. The app now treats it as optional and strips the SDK's empty parameter; an explicitly configured audience is still passed. Eight integration tests pass, including both configurations. This redirect alone does not establish successful consent or token exchange.

## Checked contracts
- Live OAuth failure diagnosed: SDK 0.8.1's token helper omits `User-Agent`, and Cloudflare Workers does not provide the Node.js default. Production token requests with an empty header return 403 HTML; the same controlled invalid-code request with an honest `Tabletalk/1.0` identifier returns the normal OAuth 400 `invalid_grant`. Token exchange now uses the documented form POST with this header, the SDK's environment URLs/error normalization, a 15-second timeout, and redirects disabled. The contract test requires the header. Discovery/member SDK calls already include their own User-Agent.
- `FlynetMemberClient.getProfile()` uses `/users/me` and OAuth; canonical returned `id` binds the local identity. No unsigned token payload establishes identity.
- `listCheckIns({page, pageSize})` sends `/users/me/check_ins?page=0&page_size=50`. Wire `check_ins`, `created_at`, `ended_at`, `next_page` become `checkIns`, JavaScript Date objects, and `nextPage`.
- Embedded locations use physical location IDs, nested restaurant and neighborhood, address, optional/null name and coordinates. Brand IDs cannot authorize another location's review.
- Restaurant assets use wire `web_2x`/`preview_1x`, exposed as `web2x`/`preview1x`; `website_url` becomes `websiteUrl`. Price and optional image/coordinates have safe fallbacks.
- Required location fields include restaurant, neighborhood, address, time zone, boolean flags and timestamps. Some documentation examples omit fields required by the SDK: these examples cannot be copied verbatim as complete fixtures. Malformed responses fail without manufacturing verification records.
- Pagination is zero-based and terminates at `next_page:null`. Tests exercise two pages, repeated-location deduplication, empty history and non-advancing pagination rejection.
- Empty-body 401/403 responses reject through the SDK; no successful import is fabricated.
- Discovery uses API-key auth; check-ins/profile use member OAuth. The SDK's old inline OAuth example mentions `read:checkins`, but the current member route requires `read:user_checkins`; the app requests the latter.
- Only scopes `read:profile read:user_checkins` are requested. Wallet balances are intentionally omitted.

## Review authorization
A matching imported visit must belong to the current Blackbird member and exact location, in the same staging/production environment. This is checked for both insert and edit. Fake client `verified`/`userId` fields grant nothing. Demo/platform identities are rejected even if an erroneous visit row exists. Public reviews and score calculations exclude legacy unverified rows. Imported visit history remains private.

Verification proves attendance at the location according to the imported Blackbird record, not the accuracy of a review's text or manually selected meal date. Existing imported proof remains usable after OAuth access expires; reconnect is needed to import newer history.

## Source references
- [Member check-ins](https://docs.flynet.org/api-reference/users/list-check-ins)
- [Location](https://docs.flynet.org/api-reference/locations/get)
- [Authentication/scopes](https://docs.flynet.org/concepts/authentication)
- [Pagination/errors](https://docs.flynet.org/concepts/pagination-errors)
- Installed source: `node_modules/@flynetdev/core/dist/client.js`, `dist/auth/flynet-oauth.js`, and `dist/generated/models/{user,check-in,location,restaurant,pagination}.js`.

## Live verification
`INTEGRATION.md` contains the repeatable smoke test. Discovery, sign-in, canonical profile, automatic private import, and guest privacy have been checked live; publishing a real member review remains optional manual validation. Staging is visibly labeled; production access is separate.

## NYC postal address coverage
The city-name-only filter omitted 26 real Queens locations whose postal cities are Astoria, Long Island City, Forest Hills, Glendale or Ridgewood. Discovery and private visit sync now share a filter that also recognizes NYC ZIP ranges with a New York state check. Mixed Queens/Nassau ZIPs require an explicit borough city name; broad “New York, NY” region labels alone do not establish NYC location (Westbury is excluded). Coverage is based on the [NYC Department of Finance postal-range reference](https://home4.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-2-instr_2025.pdf). Catalog cache keys include the filter version so the deployment refreshes old snapshots.
