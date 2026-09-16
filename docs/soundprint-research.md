# SoundPrint feasibility research

Reviewed September 17, 2026. Research only; no production import or app changes.

## Finding

SoundPrint is a plausible source for restaurant noise filters. Its public venue pages expose historical average decibels, a noise category, measurement counts, venue addresses, and time-of-day breakdowns. These are crowdsourced estimates, not live noise readings. See the [FAQ](https://www.soundprint.co/faq).

I did not find a documented self-service public API or downloadable venue-level dataset. SoundPrint's [research page](https://www.soundprint.co/about/research) offers select data to researchers and other interested entities. It directs data-access inquiries to info@soundprint.co with subject “Research.” Access for our specific product is not confirmed.

Their [terms](https://www.soundprint.co/terms-conditions), particularly Articles 12 and 18, require advance written permission for business reuse of venue noise data and restrict automated collection. Request a licensed export or API before importing ratings into Tabletalk.

## Confirmed overlap sample

Compared a bounded sample of public SoundPrint listings against our September 16 local catalog snapshot containing 855 locations. Matches below use restaurant name and street address, not brand name alone. This proves some overlap; it does not establish total coverage or a coverage percentage.

| Our restaurant | Matching address | Blackbird location ID | SoundPrint listing |
| --- | --- | --- | --- |
| Devoción | 276 Livingston St, Brooklyn | `ce5d0441-700f-4617-881a-e992993f4f67` | [147593](https://www.soundprint.co/location/devocion-cafe-brooklyn-ny-147593) |
| Cafe Colette | 79 Berry St, Brooklyn | `2875050e-5881-4c31-84d7-c16794cea7d5` | [16802](https://www.soundprint.co/location/cafe-colette-brooklyn-ny-16802) |
| Frenchette | 241 W Broadway, Manhattan | `f485e76b-d2ac-4a6c-883d-073e770fbae2` | [3474](https://www.soundprint.co/location/frenchette-new-york-ny-3474) |
| Le Pavillon | One / 1 Vanderbilt Ave, Manhattan | `ad083c2a-46e8-4e0d-a098-cecfe93d50e1` | [4166498](https://www.soundprint.co/location/le-pavillon-new-york-ny-4166498) |

The catalog has six Devoción branches. The confirmed listing applies only to Livingston Street; never copy its score to the other branches. Similarly, Frenchette's restaurant must remain separate from its bakeries.

## Available information and limitations

Public pages reviewed expose:

- Venue name, address and a location identifier in the page URL.
- Overall historical decibel average and Quiet / Moderate / Loud / Very Loud category.
- Total SoundCheck count.
- Time bins: 5–11am, 11am–6pm, 6–10pm, and 10pm–5am, with averages and counts where available.

The linked Cafe Colette page illustrates why time bins matter: its morning and late-night observations differ substantially, with only one measurement in each of those bins. Devoción's linked listing has only two measurements overall. A category alone conceals that uncertainty.

The reviewed pages do not clearly expose the last measurement's calendar date. Search-engine crawl dates are not measurement dates. Request recency information from the provider, and treat missing recency as unknown. Preserve their supplied category; published decibel range descriptions overlap at some boundaries, so confirm exact rounding and cutoffs before deriving categories ourselves. The separate out-of-ten venue rating shown on some pages is not the noise measurement.

## Proposed integration, subject to data access

1. Obtain permission covering public display, local caching, derived filters, attribution, refresh frequency, and deletions. Ask for a NYC overlap count before negotiating a larger dataset.
2. Match a provider venue ID to our existing Blackbird location ID using normalized name and address, with coordinates as an additional check if provided. Manually review ambiguous branches, relocations and duplicates.
3. Store licensed aggregates in D1, including provider ID, source URL, average dBA, supplied category, measurement count, time bins, last measurement time (nullable), and our import timestamp. Keep measurement age separate from import age.
4. Refresh through the agreed API/export schedule. Read from D1 for page requests; do not fetch SoundPrint pages per visitor.
5. Offer noise filters separately from occasion tags such as Date night and Brunch. Preserve “Unknown”; missing data must never qualify as quiet. Show attribution, sample count, and the relevant time period. Mark limited samples explicitly.
6. If sufficient coverage and recency are available, add time-aware choices such as quiet mornings. Agree a minimum evidence threshold before labeling a venue reliably quiet.

Without a data agreement, an independent alternative is a subjective noise question in our verified-visit reviews: Quiet / Easy conversation / Have to raise your voice. Keep those votes clearly separate from measured decibels and SoundPrint data. This would start with no ratings and would need contributions; an LLM cannot supply measured noise levels.

## Draft inquiry — not sent

To: info@soundprint.co

Subject: Research — NYC restaurant noise data for Tabletalk

Hello SoundPrint team,

We are building Tabletalk, a public restaurant discovery and social review app focused on Blackbird restaurants in NYC. We would like to help people find places where they can comfortably talk, including quieter cafés by time of day.

Do you offer a licensed API or periodic export for displaying venue noise categories and supporting filters? Our current catalog contains 855 locations. We have confirmed address matches for Devoción on Livingston Street, Cafe Colette, Frenchette and Le Pavillon, and would like to understand broader coverage.

Ideally the data would include venue IDs and addresses, average dBA, category, measurement counts, time-of-day breakdowns, and the most recent measurement date. We would cache approved aggregates in our database and attribute and link to SoundPrint.

Could you share availability, pricing, attribution requirements, permitted caching and filtering uses, refresh options, and how updates or removals should be handled?

Thank you.
