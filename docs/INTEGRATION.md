# Connecting the live Blackbird network

## Access request, ready to paste
**Project:** Tabletalk

**Description:** An open NYC dining notebook: public restaurant lists, reviews, personal rankings and a social feed. Flynet powers restaurant/location discovery, Blackbird sign-in, and member-authorized check-ins that privately verify restaurant visits. Raw member history is never auto-published. We are building for Runtime's Blackbird track.

**Access needed:** staging Discovery API key with restaurant/location read access; OAuth client ID and secret; audience value; scopes `read:profile read:user_checkins`; exact redirect URI registration. No wallet, rewards or payment scopes required.

**Apply:** https://docs.flynet.org/resources/request-access

The official guide also suggests asking for expedited access in Runtime Discord. No application or message has been sent on your behalf.

## Environment
- `FLYNET_ENVIRONMENT`: `staging` (default) or explicitly `production`.
- `FLYNET_API_KEY`: Discovery key for the chosen environment.
- `FLYNET_CLIENT_ID`, `FLYNET_CLIENT_SECRET`: values issued by Blackbird.
- `FLYNET_AUDIENCE`: optional; leave blank unless Blackbird supplies it. Although SDK 0.8.1 requires a string, the current OAuth guide omits this parameter and the production gateway accepts its omission. The app removes the SDK's empty audience parameter.
- `FLYNET_REDIRECT_URI`: `https://your-app.example/api/auth/blackbird/callback`. Exact matching matters. Ask Blackbird to register this path, not the platform-reserved `/callback`.
- `TOKEN_ENCRYPTION_KEY`: at least 32 random characters generated securely; encrypts stored access tokens with AES-GCM. Rotating it requires Blackbird reconnect for existing sessions.

For local development set `.env`. For hosting use Sites environment variables and redeploy if the platform requires it. Never commit real values. Staging and production credentials are separate.

## Live smoke test (requires credentials)
1. Open a public restaurant/list page in an incognito browser; it must render without authentication.
2. Click Connect with Blackbird, approve only the requested scopes, and land on `/me?connected=1`.
3. Confirm the profile uses the authenticated member and no token appears in HTML, browser storage, network DTOs or logs.
4. Open Explore signed out; the catalog populates automatically from Discovery. The same-origin `POST /api/flynet/discovery` checks this shared cache without requiring sign-in and cannot bypass the refresh interval.
5. Open My profile; verify visits sync automatically and actual NYC check-ins appear only in Private passport. Existing signed-in sessions also start syncing when they next load a page.
6. Attempt a review without a verified visit: expect 403. Once automatic syncing finishes, write/edit a public review for a verified venue. Check that another location of the same restaurant brand, another member’s visit, and a legacy demo session all remain blocked. A client-supplied `verified` flag must never authorize a review.
7. View the list/review in a second browser and confirm private history remains absent.
8. Exercise logout and reconnect; repeat sign-in should recover the same Blackbird account.
9. After provider token expiry, importing requests reconnect. Existing app reviews/lists remain usable. Refresh tokens are deliberately discarded in this MVP to avoid storing an additional credential or racing single-use rotation.

## Operational notes
- Public restaurant data is mirrored in D1. The first uncached request waits for import; later requests serve the saved snapshot. After six hours the next visitor triggers a background refresh. A database lease prevents simultaneous refreshes across Workers; failed imports preserve the last complete snapshot and wait five minutes before retrying. A stopped Worker's lease expires after two minutes. No scheduled refresh occurs while the site is idle.
- Snapshot membership is published only after all Discovery pages finish. Incomplete/failed imports never replace the visible catalog. Old venue rows remain for saved lists and historical reviews; they are excluded from Explore when absent from the latest snapshot. Member check-ins never enter this shared cache.
- Discovery and visit imports process up to 40 pages of 50 rows per request. A `complete:false` result means the bound was reached; do not claim a full history import.
- Imports upsert by physical location ID. Brand-level restaurant IDs are not interchangeable with location IDs.
- Staging records are visibly distinguished from live production participation.
- Member history sync is automatic after sign-in and remains private. Authenticated page loads check every 15 minutes while provider access is valid; failures preserve saved visits and retry after five minutes. A per-member lease prevents overlapping syncs. No raw user history is inferred from the anonymized venue check-in feed.
- Blackbird is the only accepted identity. Legacy demo/platform sessions are rejected; their records are not merged into Blackbird accounts.
- Sessions last 30 days. Provider access is usable only until its issued expiry. Deleting a local session on logout removes its encrypted provider token.
- No FLY transfer, reward issuance or onchain signature is performed by the app.

## Review policy and balances
Reviews require an imported member check-in for the exact location; saves and lists require Blackbird sign-in but do not require a visit. The UI and API both enforce this. Demo reviews are no longer published, and legacy unverified rows are hidden from public feeds and averages. Staging proofs are labeled staging and cannot authorize a production location. Wallet balances are intentionally omitted; `read:wallets` is not requested.
