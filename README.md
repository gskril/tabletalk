# Tabletalk

A NYC dining notebook with restaurant discovery, maps, public lists, verified reviews, personal rankings, and a friends activity feed. Blackbird / Flynet provides restaurant discovery, sign-in, and member-authorized visit verification.

## Features

- Search restaurants by cuisine, neighborhood, price, and dining occasion; explore them on an OpenStreetMap map.
- Create ordered public or private lists, save restaurants, and follow other diners.
- Write and edit reviews for locations verified through your Blackbird check-ins.
- View personal visit counts, rankings, and activity from people you follow.
- Browse public restaurants, lists, profiles, and community reviews without signing in.

## Local development

Use Node.js 24 and npm. Blackbird credentials are required for live discovery and OAuth; a clean database has no sample catalog. Tests provision their own synthetic fixtures.

```sh
npm ci
cp .env.example .env
# Fill in your own credentials for live integration.
npm run build
```

Initialize a **new local database** by applying all SQL migrations in order, once:

```sh
for migration in drizzle/*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
    d1 execute DB --local --config dist/server/wrangler.json \
    --persist-to .wrangler/state --file "$migration" || break
done
npm run dev -- --port 5173
```

For an existing database, apply only migrations it has not received. Migration files contain schema changes, not exported user records. `npm start -- --port 5173` serves the production build locally.

See [Blackbird integration](docs/INTEGRATION.md) for environment variables, OAuth configuration, and data visibility. The checked-in hosting template defines local bindings. Deployment-specific Sites configuration belongs in ignored `.openai/hosting.json`; credentials belong in ignored `.env` files or your host's environment settings.

## Validation

```sh
npm run typecheck
npm run lint
npm run test:contract
npm run build
```

For browser tests, follow [the testing guide](docs/TESTING.md). Test fixtures live under `tests/fixtures/` and are never seeded by application page loads. Local databases, reports, traces, credentials, and deployment identifiers are excluded from version control.

## Architecture

React and TypeScript on Vinext, Cloudflare Workers, D1/SQLite with Drizzle migrations, Radix UI, the official Flynet SDK, and Leaflet/OpenStreetMap. Application code lives in `app/`, `components/`, and `lib/`.

OAuth uses PKCE and one-use state. Provider access and rotating refresh tokens are encrypted at rest. Writes require a Blackbird session, same-origin validation, authorization, and rate limits. Public catalog responses are cached separately from private account state. Following feeds show friends' visit activity; public profile responses expose aggregate visit counts without raw provider check-in IDs. See the integration guide for details.

[Restaurant labels](docs/restaurant-labels.md) use reviewed public restaurant sources with provenance and expiration; missing labels mean unknown. The data and research scripts are retained to support those filters.

This is a small application, without a production moderation console, reservations, payment processing, direct messages, or photo uploads. Restaurant imagery and fonts remain subject to their owners' rights; bundled font and third-party licenses are retained. Tabletalk is an independent project and does not claim affiliation with Blackbird or Beli.
