import { restaurantLabelResearch } from "../data/restaurant-labels";

import {
  OCCASION_LABELS,
  occasionLabels,
  type OccasionLabel,
} from "./occasion-labels";
export { occasionLabels } from "./occasion-labels";
export type LabelSource = { label: string; url: string; checkedAt: string };

function websiteHost(url: string) {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol)
      ? u.hostname.toLowerCase().replace(/^www\./, "")
      : "";
  } catch {
    return "";
  }
}

export function researchedLabels(
  id: string,
  source: string,
  website: string,
  name: string,
): LabelSource[] {
  const entry = restaurantLabelResearch[id];
  // Exact Blackbird location, restaurant identity and official site; no cross-environment or chain-wide inference.
  if (
    source !== "production" ||
    !entry ||
    entry.name !== name ||
    !websiteHost(website) ||
    websiteHost(entry.website) !== websiteHost(website)
  )
    return [];
  // Old research is omitted until reviewed again, never silently treated as current.
  const age = Date.now() - Date.parse(entry.checkedAt);
  if (!Number.isFinite(age) || age < -86400000 || age > 180 * 86400000)
    return [];
  return entry.labels
    .filter(
      (item) =>
        OCCASION_LABELS.includes(item.label as OccasionLabel) &&
        /^https?:\/\//.test(item.url),
    )
    .map((item) => ({ ...item, checkedAt: entry.checkedAt }));
}

export function enrichedVenue<
  T extends {
    id: string;
    source: string;
    website: string;
    name: string;
    tags: string;
  },
>(venue: T) {
  const sources = researchedLabels(
    venue.id,
    venue.source,
    venue.website,
    venue.name,
  );
  const researched = sources.map((s) => s.label);
  // Research persisted on earlier syncs must not survive its review window or a restaurant identity change.
  const previousResearch =
    restaurantLabelResearch[venue.id]?.labels.map((l) => l.label) || [];
  const provider = occasionLabels(venue.tags).filter(
    (tag) => !previousResearch.includes(tag),
  );
  return {
    ...venue,
    tags: JSON.stringify(occasionLabels([...provider, ...researched])),
    tag_sources: sources,
  };
}
