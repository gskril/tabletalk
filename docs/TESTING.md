# Validation report — September 15, 2026

## Passing checks
- **TypeScript:** `npm run typecheck` — passed.
- **Production build:** Sites build helper / Vinext Worker build — passed.
- **Browser E2E:** six Playwright suites against the built Worker; includes Blackbird-only UI and rejection of retired authentication methods.
- **Flynet contracts:** actual app OAuth and import handlers with official `@flynetdev/core` 0.8.1 and controlled upstream responses — **13 passed**.

### Browser coverage
1. Anonymous restaurant search, empty results/reset, neighborhood filter, zoomable map selection, venue navigation, directions, mobile width.
2. Local synthetic Blackbird member session, bookmark persistence, review gate and forged-verification rejection, ordered list creation/reordering, public list in another browser, second-account list saving, and follow/feed controls. Verified review CRUD is covered by actual-handler contract tests; live OAuth browser verification remains pending.
3. Anonymous write rejection; cross-origin rejection; private-list 404 and exclusion from public DTOs; second-account edit/save rejection; invalid rating/date rejection; idempotent bookmarks; logout.
4. Unconfigured Blackbird sign-in explains the unavailable integration; forged callback does not create an authenticated session.
5. Blackbird-only sign-in UI, retired signup returns 410, legacy session and platform header rejection.
6. WebMCP registration contract, valid query and invalid-input rejection using a test implementation of the proposed browser registry. Native browser WebMCP support was not available; this is a contract harness, not native interoperability certification.

### Flynet contract coverage
- OAuth authorize URL uses exact scopes and S256 PKCE; audience is optional and included only when configured.
- Cookie-bound state, invalid-state rejection, expiry and atomic one-use callback consumption.
- Token exchange uses client secret and verifier; canonical member profile determines identity.
- AES-GCM ciphertext storage and tamper rejection; provider refresh token is not retained.
- No provider email or raw token is exposed as profile data.
- Member-scoped import writes private visit records and no public review; repeated imports deduplicate.
- Expired provider access requires reconnect.
- Discovery sends API-key auth and excludes non-NYC addresses.
- Review create/edit requires the current Blackbird member’s imported visit at the exact location. Demo/platform identities, other members, sibling locations, mismatched environments and client-supplied verification all fail. Unverified legacy reviews are excluded from public data and scores.
- SDK parser handles wire naming, optional/null fields, image/coordinate mapping, Date conversion, repeated visits and multiple pages. Empty history succeeds; malformed payloads, empty-body 401/403 and broken pagination fail without fabricated proof.
- See `SDK-AUDIT.md` for source-level findings and confidence limits.

## Visual checks
Desktop (1440px) and mobile (390px) rendered. All 11 venue images loaded in the browser. No horizontal overflow at 390px. Map has visible OpenStreetMap attribution, zoom controls, keyboard-accessible markers and a separate restaurant picker.

## Bugs found and fixed
- Overlapping pins in the original illustrative map: replaced with a zoomable Leaflet street map and a separate picker.
- Production-only Vinext client Link error: restaurant and list navigation now uses standard browser links; post-save navigation performs a full route load. The built Worker suite passes this behavior.
- Development preview instability during simultaneous build/testing: final regression ran against the production Worker after building.
- Repeated test runs left earlier review text in the local database: review assertions now use unique content. Local test data is not part of the deployment archive.

## Published site smoke test
- Current site: https://your-app.example.
- Production Discovery: all 34 pages parsed through SDK 0.8.1; 1,675 locations, 808 matching NYC after including Queens postal city names. Westbury remains excluded.
- Live shared D1 cache serves the complete catalog to guests. Anonymous state returns no current member, passport, or private visits.
- Live browser search, real restaurant detail, and 390px mobile overflow checks passed with no browser errors on the preceding catalog release.
- Real Blackbird sign-in and canonical profile creation are confirmed. The OAuth token exchange supplies the documented User-Agent and uses Workers-supported manual redirects.
- Production passport sync is ready with complete history import and persisted private visits. No additional Connect or Import action is required.
- Fourteen contract tests pass, including NYC postal coverage, SDK schemas, review authorization, shared catalog concurrency/failure, automatic passport concurrency/privacy/recovery, and OAuth handlers.
- The production build and TypeScript checks pass. Browser coverage includes public exploration, lists, reviews, social actions, Blackbird-only auth, automatic passport states, and WebMCP. Interrupted local Worker scenarios passed after server restart.

## Explicitly not verified
No real member review has been published in production. Existing sample reviews remain hidden; create/edit authorization is verified with controlled integration and browser tests. No money was moved. No hackathon submission or demo video was uploaded. See `INTEGRATION.md` for the repeatable live smoke test.

## Reproduce
Build, apply all four local migrations once, start the local Worker with an explicitly empty test environment file (do not use production credentials for the synthetic suite), then:

```sh
TEST_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
npm run test:contract
npm run typecheck
```

The browser suite provisions synthetic Blackbird-like sessions directly in the local SQLite database. The helper refuses non-local targets; no testing authentication route or bypass is deployed. OAuth itself is tested through the real handlers and SDK with controlled upstream responses. Real Blackbird sign-in and automatic private history import are now confirmed.

## Automatic passport update
- Successful real Blackbird sign-in is now confirmed by the owner and a persisted production profile.
- Authenticated page loads start private visit sync automatically, including existing sessions; the browser polls only while syncing. Normal use has no Connect/Import controls. Retry appears after sync errors; Reconnect appears only when provider access is unavailable.
- Fourteen contract tests pass, including OAuth-to-automatic-sync, concurrent import deduplication, no repeated calls while fresh, guest privacy, retry and expired/revoked access.
- Targeted browser checks for notebook behavior, Blackbird-only auth, and automatic passport/recovery states pass. The local Worker stopped during the first passport browser attempt; the isolated rerun passed after restart.
- The first live automatic visit sync completed successfully; a real visit-backed review has not been published.

## Placeholder retirement
- Fifteen contract tests pass. Legacy demo/platform accounts, their lists/items, and demo venues are excluded from state. Real Blackbird members remain visible even with no posts or visits. Attempts to follow/save/bookmark retired fixtures return 404.
- Direct profile/list/venue routes and metadata use the same visibility rules. Production page loads no longer create sample records.
- Historical rows are retained in D1, hidden from the app; no real account or user-authored data is deleted. Browser tests provision their own synthetic catalog explicitly in the local database only.
