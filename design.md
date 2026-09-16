# Tabletalk design system

## Chosen direction: Corner Bistro, made for an everyday app

Tabletalk is a warm, practical restaurant and social notebook for New Yorkers who
make plans around food. The audience is roughly late twenties to late thirties:
people who care about a good restaurant and the friends they take there.

The approved foundation is **Corner Bistro**, a refinement of **The Regular**.
Keep its burgundy, cream, expressive serif wordmark, and neighborhood hospitality.
Translate that identity into a useful application: a compact left-aligned header,
immediately visible search, photo-led restaurant results, and readable personal
recommendations. The application should feel inviting, considered, and familiar.

This file is the source of truth for future screens and refinements. The temporary
brand comparison pages are retired when this design ships.

### Principles

1. **Food first.** Restaurant photography and names carry the page. Avoid a large
   promotional hero that pushes search and results down the screen.
2. **People provide context.** Show real authors, reviews, visited places, and list
   ownership. Never manufacture friends, activity, ratings, or popularity.
3. **Comfort is usability.** Familiar navigation, clear labels, readable text, and
   quick responses matter as much as color. Keep primary controls easy to reach.
4. **One coherent system.** Discovery, lists, profiles, maps, forms, errors, and
   account recovery use the same typography, colors, spacing, and interaction rules.
5. **Restraint gives the brand character.** Use the serif for identity and hierarchy.
   Use plain interface typography for controls. Avoid centered magazine mastheads,
   oversized editorial intros, decorative double rules, crests, utensil logos,
   floating cards, colored score medallions, and repetitive slogan copy.

## Color

Define colors as semantic variables in `app/globals.css`. Components consume these
variables; no new orange/green legacy theme colors or arbitrary inline fills.

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#FFFAF2` | Warm cream page canvas |
| `--foreground` | `#382A2B` | Primary readable text |
| `--card` | `#FFFDF8` | Cards, menus, form fields, dialogs |
| `--primary` | `#7D2939` | Wordmark, primary actions, active navigation |
| `--primary-hover` | `#652130` | Hover/pressed primary action |
| `--primary-foreground` | `#FFFFFF` | Text on burgundy |
| `--muted-foreground` | `#75635F` | Secondary descriptions and metadata |
| `--surface-tint` | `#F4E6DB` | Restrained list covers and sync/empty surfaces |
| `--surface-soft` | `#F8F0E6` | Secondary controls and subtle emphasis |
| `--border` | `#DCCBC0` | Input borders and structural separators |
| `--success` | `#466044` | Quiet verified-visit text |
| `--destructive` | `#A12E32` | Errors and destructive actions |
| `--error-background` | `#FCECE7` | Error message surface |

Cream dominates; burgundy appears in the wordmark, selected controls, and key
links. Photographs supply most of the visual variety. Old stored profile/list
colors remain data-compatible, but presentation uses this unified palette. Never
use color as the only indicator of selection, validation, or verification.

## Typography and identity

- **Newsreader**, locally hosted variable Roman and Italic: wordmark, page and
  section headings, restaurant names, and list titles.
- **DM Sans**, locally hosted variable Roman: body copy, navigation, forms,
  metadata, counts, buttons, and ratings.
- Fallbacks: Georgia for Newsreader; Arial/Helvetica/system sans for DM Sans.
- Use `font-display: swap` and Latin WOFF2 subsets. Preload the two Roman faces;
  load the italic face only if used. Keep font licenses with the assets.

| Role | Desktop | Mobile | Notes |
| --- | --- | --- | --- |
| Wordmark | 36 px | 32 px | Newsreader 500; lowercase `tabletalk`, no dot or icon |
| Page title | 40–48 px | 34–38 px | Newsreader 400/500; left aligned |
| Discovery title | 34 px | 30 px | Compact; search and results follow directly |
| Section title | 28–30 px | 25–28 px | Newsreader 400/500 |
| Restaurant/list card title | 27–30 px | 25–28 px | Newsreader; natural wrapping |
| Body | 16 px | 16 px | DM Sans; line-height 1.5–1.65 |
| Control/metadata | 14 px | 14 px | DM Sans; do not shrink important labels |
| Secondary caption | 12–13 px | 12–13 px | Dates, provenance, photo captions only |

Use short lines and modest negative tracking on serif headings. Avoid italic
phrases in every heading. The wordmark is a simple typographic mark with clear
space approximately the width of one lowercase `o`. Minimum standalone width:
112 px. The favicon is a cream `t` on burgundy, with a modest corner radius.
Blackbird is named in sign-in and visit verification; it is not the product logo.

## Layout and spacing

- 4 px base spacing step; common spaces 8, 12, 16, 24, 32, 48 px.
- Maximum content width 1280 px; desktop gutters 32 px, mobile 20 px (16 px at
  very narrow widths).
- Desktop header approximately 72 px tall, with left-aligned wordmark, text
  navigation, and account action. Mobile uses a compact identity row and a
  clearly labeled navigation row. Avoid an oversized masthead.
- Use a three-column discovery grid on wide screens, two columns at intermediate
  widths, and one generous column on narrow phones. Restaurant photos remain
  large enough to be useful; do not squeeze names and controls into tiny cards.
- Use 4–6 px corner radii on controls, photos, and panels. Rounded avatars remain
  circular. Avoid large pill-shaped containers and thick decorative framing.
- Structure pages with spacing and occasional 1 px dividers. No decorative double
  rules in the application. Cards do not float or lift on hover.
- Detail pages show the main photograph before supporting information on mobile.
  Sidebars stack naturally after the main content; they do not obscure the food.

## Restaurant imagery

Use real restaurant/provider images already associated with the location. Never
substitute a generic food photo for a specific restaurant. Keep the provider's
preview image for compact rows and mobile cards, and its web image for large
views. Preserve the existing `RestaurantImage` component's responsive sources,
lazy loading, fixed dimensions, fallback, and eager loading for the detail photo.

- Cards: consistent 4:3 area, modest 4 px corners, natural colors.
- Details: broad 16:10 photo, without text that obscures the restaurant.
- Lists and visited places: compact photographs beside names and personal context.
- Missing images: neutral cream/tint slot with a small utensil icon and explicit
  “Photo unavailable” text; no invented photography.
- Keep image count bounded: 24 discovery cards initially, adding 24 via Show more.
  Search continues to cover the entire catalog and resets the visible batch.

## Components

### Buttons, navigation, and inputs

Burgundy is the main action; secondary actions use a light surface and thin border.
Use consistent 44 px minimum touch targets, 14 px labels, 4–6 px corners, and visible
keyboard focus. Selected states use a border/underline plus text or an icon, as
well as color. Inputs remain light, with clear labels and useful errors. Keep
existing accessible dialog, select, and tab primitives; theme their tokens.

### Restaurant cards and ratings

Lead with the photo, then a serif restaurant name and plain neighborhood/cuisine
metadata. Keep Save on the image as a small accessible control. Remove repeated
network ribbons from every photograph. State the Blackbird catalog context once
per discovery view. A score is a compact text value, not a large colored circle.
When there are no reviews, show a quiet “No reviews yet” caption rather than a
large “New” medallion or repeated invitation to review.

### Lists

Use real restaurant cover photos, a clear title, description, author, and place
count. A private list gets a quiet lock/visibility label. Use the shared warm
palette for all collections, rather than old yellow/red/green full-card fills.
Remove oversized decorative counts. List detail pages use a compact cream/tint
header and photo rows. Editing, sharing, and saving remain visible, labeled actions.

### Reviews and community

Use real avatars when supplied by Blackbird, with burgundy initials as fallback.
Show the author, restaurant, body, dish note, rating, and quiet visit verification.
Community pages use a practical activity column and a people list. Preserve the
existing ranking by distinct verified places visited; describe it plainly.
Empty activity is an honest empty state, never a fabricated social feed.

### Notebook and profiles

Keep the established distinctions: Saved places, Been there, and Lists. Profiles
show public verified places and reviews. Private visit dates stay in the owner's
notebook. Statistics are small sans-serif values; a person's name is the heading.
Use the same photo rows, tabs, actions, and empty states throughout.

### Dialogs, notices, errors, and maps

Dialogs use the same cream surface, burgundy actions, modest radius, and serif
title. Apply the system to sign-in, review, list creation/editing, profile editing,
and destructive confirmations. Sync/reconnect notices are compact tinted panels;
reserve error styling for an actual failure. Toasts use the same palette and type.
Map markers use burgundy and a cream border; selected controls and map pickers
match the rest of the app. Attribution stays readable.

## Voice

Warm, direct, and useful. Talk about places, meals, people, and occasions. Use
specific information instead of slogans. Good examples: “Lists from the community,”
“Places you've saved,” “No reviews yet,” and “Reconnect to update your visits.”
Avoid constant dining puns, luxury/exclusivity promises, forced slang, developer
setup details in account flows, and decorative copy above practical controls.

## Motion and accessibility

- Prefer 120–160 ms color/border transitions. No card elevation, image zoom, or
  playful rotation. Honor reduced-motion preferences.
- Keep text contrast at WCAG AA (4.5:1 normal, 3:1 large); preserve focus outlines.
- Support keyboard navigation, browser zoom, long restaurant/list names, and
  320 px mobile viewports without clipping controls or horizontal page scrolling.
- Distinguish privacy, selected state, and verified visits with words/icons as well
  as color. The redesign must not weaken server authorization or review gating.

## Performance and data invariants

Preserve the five-minute public restaurant cache, no-store private state, batched
D1 reads, responsive image previews, 24-card rendering batches, Blackbird-only
authentication, automatic token renewal, and verified-visit review requirements.
Do not introduce mock content, change public/private access, or replace a working
feature to simplify the redesign. No new backend integration is needed for this
visual change.

## Delivery and verification

Apply the design to discovery/grid/map, restaurant detail, lists index/detail,
community feed, all notebook tabs, own/public profiles, About, loading/empty/error
states, 404, and every account/edit/confirmation dialog. Verify real rendered
pages with local fixtures, including mobile and keyboard flows. Check the existing
integration and browser suites, updating only assertions whose intended copy or
presentation changed. Remove `public/brand` and ensure `/brand` and its former
pages return 404 in the packaged app. Commit and publish the cohesive result.
