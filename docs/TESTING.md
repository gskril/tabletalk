# Testing

Use Node.js 24. Install dependencies with `npm ci`.

## Static and contract checks

```sh
npm run typecheck
npm run lint
npm run test:contract
npm run build
```

Contract tests run the actual API handlers and official Flynet SDK against controlled upstream responses and an in-memory SQLite database. They cover OAuth state/PKCE/replay protection, encrypted token renewal, catalog and passport synchronization, review eligibility, privacy and ownership boundaries, restaurant labels, visit counts, and feeds. No live credentials are required.

## Browser tests

Use a separate clean checkout with no real credentials or database exports. Build the app, initialize the local database with all migrations as described in the README, then start the built Worker:

```sh
npm start -- --port 5173
```

In another terminal:

```sh
npx playwright install chromium
TEST_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
```

The local-session helper explicitly seeds synthetic people, lists, venues, and sessions in the local D1 database. It refuses non-local URLs. Fixtures are test-only; the application does not offer a test authentication bypass. Browser tests cover discovery, maps, lists, reviews, profiles, visit counts, social feeds, and authorization failures. Provider OAuth is covered by the separate contract suite.

Screenshots and traces go to ignored `test-results/`; the report goes to ignored `playwright-report/`. Do not commit database files or captured account data. Live provider verification is separate from these controlled tests; see the integration guide for a manual smoke-test procedure.
