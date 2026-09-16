export const OCCASION_LABELS = [
  "Date night",
  "Brunch",
  "Good for groups",
  "Casual",
  "Vegetarian",
] as const;
export type OccasionLabel = (typeof OCCASION_LABELS)[number];

/** Unknown provider metadata must never become an arbitrary public filter. */
export function occasionLabels(raw: unknown): OccasionLabel[] {
  let values = raw;
  if (typeof values === "string") {
    try {
      values = JSON.parse(values);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(values)) return [];
  const found = new Set<OccasionLabel>();
  for (const item of values) {
    // SDK restaurant tags are untyped objects. Accept only a named, known label.
    const value =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.name
          : null;
    if (typeof value !== "string") continue;
    const label = OCCASION_LABELS.find(
      (label) => label.toLowerCase() === value.trim().toLowerCase(),
    );
    if (label) found.add(label);
  }
  return OCCASION_LABELS.filter((label) => found.has(label));
}
