# Validation report — September 15, 2026

## Passing checks
- **TypeScript:** `npm run typecheck` — passed.
- **Production build:** Sites build helper / Vinext Worker build — passed.
- **Browser E2E:** five Playwright suites against the built Worker at `http://127.0.0.1:5173` — **5 passed in 22.1 seconds**.
- **Flynet contracts:** actual app OAuth and import handlers with official `@flynetdev/core` 0.8.1 and controlled upstream responses — **3 passed**.

### Browser coverage
1. Anonymous restaurant search, empty results/reset, neighborhood filter, zoomable map selection, venue navigation, directions, mobile width.
2. Demo signup, bookmark persistence after reload, review creation/edit/delete, personal score ranking, ordered list creation and reordering, public list in another browser, second-account list saving, follow/feed and likes.
3. Anonymous write rejection; cross-origin rejection; private-list 404 and exclusion from public DTOs; second-account edit/save rejection; invalid rating/date rejection; idempotent bookmarks; logout.
4. Unconfigured Blackbird sign-in explains the unavailable integration; forged callback does not create an authenticated session.
5. WebMCP registration contract, valid query and invalid-input rejection using a test implementation of the proposed browser registry. Native browser WebMCP support was not available; this is a contract harness, not native interoperability certification.

### Flynet contract coverage
- OAuth authorize URL includes audience, exact scopes and S256 PKCE challenge.
- Cookie-bound state, invalid-state rejection, expiry and atomic one-use callback consumption.
- Token exchange uses client secret and verifier; canonical member profile determines identity.
- AES-GCM ciphertext storage and tamper rejection; provider refresh token is not retained.
- No provider email or raw token is exposed as profile data.
- Member-scoped import writes private visit records and no public review; repeated imports deduplicate.
- Expired provider access requires reconnect.
- Discovery sends API-key auth and excludes non-NYC addresses.

## Visual checks
Desktop (1440px) and mobile (390px) rendered. All 11 venue images loaded in the browser. No horizontal overflow at 390px. Map has visible OpenStreetMap attribution, zoom controls, keyboard-accessible markers and a separate restaurant picker.

## Bugs found and fixed
- Overlapping pins in the original illustrative map: replaced with a zoomable Leaflet street map and a separate picker.
- Production-only Vinext client Link error: restaurant and list navigation now uses standard browser links; post-save navigation performs a full route load. The built Worker suite passes this behavior.
- Development preview instability during simultaneous build/testing: final regression ran against the production Worker after building.
- Repeated test runs left earlier review text in the local database: review assertions now use unique content. Local test data is not part of the deployment archive.

## Published site smoke test
- Version 1 deployed successfully to https://your-app.example.
- Anonymous production API returned 12 sample venues, 3 public lists, no authenticated member, and an explicitly unconfigured Flynet status.
- Read-only Playwright exploration passed against the deployed site, including filters, map selection, restaurant navigation and mobile overflow check.
- The sample “Downtown, after dark” list renders in a fresh browser without authentication.

## Explicitly not verified
Live Blackbird OAuth, real Discovery, and real member history require partner-issued credentials and redirect registration. No real credentials were supplied. No money was moved. No hackathon submission or demo video was uploaded. See `INTEGRATION.md` for the exact live smoke test and access request.

## Reproduce
Build, apply the two local migrations once, start `npm start -- --port 5173`, then:

```sh
TEST_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
npm run test:contract
npm run typecheck
```

The browser suite creates local demo accounts; repeated runs in one hour may eventually reach the signup rate limit. Use a fresh test database or clear only its test rate-limit rows. Do not run mutation tests against a live community.
