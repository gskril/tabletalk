# Restaurant discovery labels

## Current evidence, September 16, 2026

The Flynet 0.8.1 SDK has a restaurant `tags` field (an array of arbitrary objects). All 1,675 locations returned by our production discovery audit had empty arrays. The separate member-tags endpoint describes members, not dining occasions. The original sample catalog supplied our five filter labels; the production catalog did not.

We attempted the official websites for all 855 locations in our public NYC catalog: 694 distinct websites, 612 readable, 82 inaccessible, and 23 locations without a website. The first reviewed release labeled 200 locations. A second review expanded this to **346 locations**, adding 146. It reviewed broader menu evidence and fetched 99 additional location, contact and private-dining pages across 53 websites. Current counts: 160 Brunch, 98 Good for groups, 75 Vegetarian, 47 Casual, and 44 Date night (categories overlap).

Missing labels mean unknown, not unsuitable. Coverage is deliberately incomplete; JavaScript-only sites, PDFs, blocked pages, ambiguous branches, and claims without corroborated addresses are excluded.

## Definitions

- **Brunch:** an explicitly published brunch menu, recurring service, or restaurant description. Breakfast alone, historical events, product names and customer anecdotes do not qualify.
- **Good for groups:** explicit large-party reservations or group dining. A gratuity threshold alone does not qualify. Booking requirements and minimum spends can apply.
- **Date night:** the restaurant describes itself as suitable for dates, romantic, or having an intimate restaurant/bar setting. A private event room or historical anecdote alone does not qualify. This is subjective and uses a deliberately narrow threshold.
- **Casual:** explicit casual dining, counter service, laid-back setting, or neighborhood hangout description.
- **Vegetarian:** an explicitly vegetarian/vegan concept, advertised vegetarian/vegan options, or a clearly labeled substantial menu option (such as a vegetarian main, sandwich, pizza, or a vegan flavor at an ice-cream shop). A menu legend, drink, incidental garnish, or a chef's biography alone does not qualify. This is not an allergy, cross-contamination, or comprehensive dietary guarantee.

Use first-party sources, not embedded customer reviews. Claims apply to the exact Blackbird location and restaurant name. Confirm the street address on fetched pages; brand-wide claims require explicit manual approval. Shared restaurant websites do not automatically confer every label on every concept. Keep URLs and review dates; do not publish scraped text.

Approvals can restrict `locationIds` for branch-specific evidence. For example, the Herald Square Black Tap menu must not label its Broome Street location. Locanda Verde's two brunch services have separate location sources; the Penn District Bar Primi uses its own page. Address normalization accepts equivalent numbered street spelling and omits unit/floor suffixes, while retaining street identity and exact restaurant name. It does not resolve alternative street entrances or missing street addresses by guessing.

Rejected examples from the second pass: Soba Ulala allows vegetarian accommodations only with fish broth; Thursday Kitchen and Luthun explicitly exclude vegetarian diets; Le Pavillon's business-casual dress code is not casual dining; Devoción's plant-based packaging is not a menu option. All remain excluded from those labels.

## Data and refresh

`scripts/research/restaurant-websites.py` collects candidates, with bounded public requests and a local cache. It never publishes labels. `approved-labels.json` records reviewed claims; `build-labels.py` requires corroborated location identity and produces `data/restaurant-labels.ts` plus a coverage audit. Cache pages are temporary research material and are not committed.

Both public catalog and full state responses apply the same reviewed dataset immediately. Regular catalog sync also copies these labels into the existing D1 `venues.tags` column. Existing public response caching remains enabled; research requires no request-time external call. The browser receives only labels and source metadata for its catalog, not the full research dataset.

Reviewed labels expire after 180 days and disappear if restaurant name, website host, or environment no longer matches. Keep expired dataset entries until their stored D1 labels have been cleared, so the response layer can suppress them. Future provider tags are accepted only when their string or `name` exactly matches one of our canonical labels.

Website research is an **offline, reviewed process**, not a scheduled model job. The existing catalog refresh does not re-research websites. No OpenRouter key or paid model API was required. Automated re-research would need scheduling, fetch/search infrastructure, evidence validation and review policy; a model key by itself would not supply those.

## Review workflow

1. Export the current public `/api/catalog` JSON and run the website collector into a temporary directory.
2. Review candidate context and branch identity; update explicit approvals.
3. Run the builder with the catalog and temporary research directory. Inspect skipped approvals and unlabeled locations in the coverage audit.
4. Run the label contracts and UI checks before publishing. Never bulk-label restaurants from keyword hits alone.
