# Blackbird / Runtime research — 15 September 2026

## Track and source audit

Read the full [Blackbird track](https://runtime.nyc/tracks/blackbird), retrieved its JavaScript-backed guide from the official handbook module, and retained the exact track object in `blackbird-track.json`. All six unique resource links in the guide were opened: [docs home](https://docs.flynet.org/), [getting started](https://docs.flynet.org/getting-started), [AI overview](https://docs.flynet.org/build-with-ai/overview), [user passport](https://docs.flynet.org/recipes/mains/user-passport), [brand guidance](https://docs.flynet.org/resources/brand), and [Runtime Discord](https://discord.gg/vmXqxGaggx). Discord cannot be read without an interactive membership session; no message was sent. Also inspected the documentation index, all linked documentation pages and official OpenAPI contract.

Track: Best Use of Flynet. Five awards of $500 in FLY. Working API/SDK integration, explicit Blackbird track selection, and a recorded demo for online submissions. Deadline shown: September 19, 2026, 4 PM EDT. The product must clearly distinguish staging/mock data from live behavior. A simulated demo alone does not satisfy proof of working live integration.

## Findings

Blackbird provides restaurant loyalty, dining history, payments and rewards. Flynet exposes that network to developers. Discovery requires a server-held API key; member routes use OAuth with PKCE and partner-approved credentials. Staging access normally takes about a week. The track explicitly suggests requesting expedited help in Runtime Discord. No credentials were supplied in this task.

Restaurant brands and physical locations are distinct. Locations include addresses, coordinates, neighborhoods and embedded restaurant context. Reviews, public lists, personal rankings and social follows are not native Flynet records: Tabletalk owns them. Member-authorized check-ins can make review provenance stronger; anonymous venue feeds cannot identify individual diners. Raw dining history is private by default.

### Integration references

- [Authentication](https://docs.flynet.org/concepts/authentication), [OAuth](https://docs.flynet.org/concepts/oauth), [API keys](https://docs.flynet.org/concepts/api-keys): separate credentials, exact scopes, exact redirect allowlist, rotating refresh tokens.
- [Data model](https://docs.flynet.org/concepts/data-model), [OpenAPI](https://docs.flynet.org/api-reference/openapi.yaml): source contract for field names and resource relationships.
- [Pagination/errors](https://docs.flynet.org/concepts/pagination-errors): zero-based pages; next-page termination; empty-body 401/403 and multiple error envelopes; unknown filters may be ignored.
- [SDK architecture](https://docs.flynet.org/build-with-ai/architecture), [member dining app](https://docs.flynet.org/recipes/mains/member-dining-app): use the published core client server-side; SDK normalizes snake_case wire fields to camelCase.
- [Restaurant explorer](https://docs.flynet.org/recipes/mains/restaurant-explorer), [check-in feed](https://docs.flynet.org/recipes/mains/check-in-feed), [user passport](https://docs.flynet.org/recipes/mains/user-passport): directly relevant recipes.
- [Payments](https://docs.flynet.org/concepts/payments), [money/tokens](https://docs.flynet.org/concepts/money-and-tokens), [first payment](https://docs.flynet.org/recipes/mains/first-payment): FLY payment intents require merchant access and explicit confirmation; integer amounts must not use float arithmetic. No payment execution belongs in this MVP.
- [Rewards](https://docs.flynet.org/api-reference/rewards/issue), challenges, specials: require app permissions/funding. Do not imply reviews automatically earn FLY. Some recipes still say coming soon despite reference endpoints; capability must be confirmed with partner access.
- [FAQ](https://docs.flynet.org/resources/faq): webhooks not generally available; explicit bounded refresh fits this app.
- [AI tooling](https://docs.flynet.org/build-with-ai/overview): Docs MCP, API MCP and agent rules share SDK semantics. Reading llms.txt/markdown and the installed SDK provides grounding without installing extra agents or exposing credentials.
- [Brand](https://docs.flynet.org/resources/brand): independent name, text credit “Powered by Flynet”; do not invent or recolor Blackbird logo.

## Decisions

Use D1 for real cross-browser persistence, public read routes and protected writes. Keep financial features outside the discovery/reviews MVP. Use original identity Tabletalk. Credential-free demo works now, with a real OAuth/SDK adapter ready for provisioned access. Report live testing as pending rather than claiming success.
