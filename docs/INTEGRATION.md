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
- `FLYNET_CLIENT_ID`, `FLYNET_CLIENT_SECRET`, `FLYNET_AUDIENCE`: values issued by Blackbird. The SDK requires an explicit audience; don't guess it.
- `FLYNET_REDIRECT_URI`: `https://your-app.example/api/auth/blackbird/callback`. Exact matching matters. Ask Blackbird to register this path, not the platform-reserved `/callback`.
- `TOKEN_ENCRYPTION_KEY`: at least 32 random characters generated securely; encrypts stored access tokens with AES-GCM. Rotating it requires Blackbird reconnect for existing sessions.
- `DEMO_ENABLED`: `true` for hackathon exploration; `false` to stop new demo signups.

For local development set `.env`. For hosting use Sites environment variables and redeploy if the platform requires it. Never commit real values. Staging and production credentials are separate.

## Live smoke test (requires credentials)
1. Open a public restaurant/list page in an incognito browser; it must render without authentication.
2. Click Connect with Blackbird, approve only the requested scopes, and land on `/me?connected=1`.
3. Confirm the profile uses the authenticated member and no token appears in HTML, browser storage, network DTOs or logs.
4. Refresh Discovery from the configured app or POST `/api/flynet/discovery` from a signed-in same-origin session; inspect live NYC location records.
5. Import visits from My profile; verify actual NYC check-ins appear only in Private passport.
6. Attempt a review before importing: expect 403. Import visits, then write/edit a public review for an imported venue. Check that another location of the same restaurant brand, another member’s visit, and a demo account all remain blocked. A client-supplied `verified` flag must never authorize a review.
7. View the list/review in a second browser and confirm private history remains absent.
8. Exercise logout and reconnect; repeat sign-in should recover the same Blackbird account.
9. After provider token expiry, importing requests reconnect. Existing app reviews/lists remain usable. Refresh tokens are deliberately discarded in this MVP to avoid storing an additional credential or racing single-use rotation.

## Operational notes
- Discovery and visit imports process up to 40 pages of 50 rows per request. A `complete:false` result means the bound was reached; do not claim a full history import.
- Imports upsert by physical location ID. Brand-level restaurant IDs are not interchangeable with location IDs.
- Staging records are visibly distinguished from live production participation.
- Import is explicit and private; no raw user history is inferred from the anonymized venue check-in feed.
- Demo, platform and Blackbird identities are separate. Connecting Blackbird does not merge a demo's data into a real member account.
- Sessions last 30 days. Provider access is usable only until its issued expiry. Deleting a local session on logout removes its encrypted provider token.
- No FLY transfer, reward issuance or onchain signature is performed by the app.

## Review policy and balances
Reviews require an imported member check-in for the exact location; saves and lists remain available without a visit. The UI and API both enforce this. Demo reviews are no longer published, and legacy unverified rows are hidden from public feeds and averages. Staging proofs are labeled staging and cannot authorize a production location. Wallet balances are intentionally omitted; `read:wallets` is not requested.
