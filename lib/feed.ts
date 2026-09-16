import { all, db, memberProfileIds } from "./data";
import { AppError } from "./auth";
import { verifiedVisitFrom } from "./review-eligibility";
import type { FeedItem, Person, Review, Venue } from "./types";

const PAGE_SIZE = 20;
export async function activityFeed(
  userId: string | null,
  params: URLSearchParams,
) {
  const scope = params.get("scope") || (userId ? "following" : "everyone");
  const kind = params.get("kind") || "all";
  if (
    !["following", "everyone"].includes(scope) ||
    !["all", "checkin", "review"].includes(kind)
  )
    throw new AppError("Unknown feed filter.");
  if (scope === "following" && !userId)
    throw new AppError("Sign in with Blackbird to see people you follow.", 401);
  let after: { at: string; id: string } | null = null;
  if (params.has("cursor")) {
    try {
      const raw = params.get("cursor")!;
      if (raw.length > 1000) throw Error();
      after = JSON.parse(atob(raw));
      if (
        !after ||
        typeof after.at !== "string" ||
        !Number.isFinite(Date.parse(after.at)) ||
        typeof after.id !== "string" ||
        after.id.length > 250
      )
        throw Error();
    } catch {
      throw new AppError("This feed page is invalid. Refresh the feed.");
    }
  }
  // The check-in feed shows the latest verified visit to each place per diner.
  // Dates come from Blackbird, never the import time. Check-in activity is scoped
  // to followed members on the server; public discovery continues to show reviews.
  const followed = "SELECT target_id FROM follows WHERE user_id=?";
  const rows = await all<{
    id: string;
    type: "checkin" | "review";
    user_id: string;
    venue_id: string;
    occurred_at: string;
    review_id: string | null;
    visit_count: number | null;
  }>(
    `
    WITH activity AS (
      SELECT 'checkin:' || v.user_id || ':' || v.venue_id AS id, 'checkin' AS type,
        v.user_id, v.venue_id, v.visited_at AS occurred_at, NULL AS review_id,
        NULLIF((SELECT count(*) FROM visit_checkins c WHERE c.user_id=v.user_id AND c.venue_id=v.venue_id),0) AS visit_count
      ${verifiedVisitFrom} AND ?='following' AND v.user_id IN (${followed})
      UNION ALL
      SELECT 'review:' || r.id AS id, 'review' AS type, r.user_id, r.venue_id,
        r.created_at AS occurred_at, r.id AS review_id, NULL AS visit_count
      FROM reviews r WHERE EXISTS(SELECT 1 ${verifiedVisitFrom} AND v.user_id=r.user_id AND v.venue_id=r.venue_id)
        AND (?='everyone' OR r.user_id IN (${followed}))
    )
    SELECT * FROM activity WHERE (?='all' OR type=?)
      AND (? IS NULL OR occurred_at < ? OR (occurred_at=? AND id < ?))
    ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    scope,
    userId || "",
    scope,
    userId || "",
    kind,
    kind,
    after?.at ?? null,
    after?.at ?? null,
    after?.at ?? null,
    after?.id ?? null,
    PAGE_SIZE + 1,
  );
  const page = rows.slice(0, PAGE_SIZE);
  if (!page.length) return { items: [], nextCursor: null };
  const ids = (key: "user_id" | "venue_id" | "review_id") => [
    ...new Set(page.map((r) => r[key]).filter((id): id is string => !!id)),
  ];
  const peopleIds = ids("user_id"),
    venueIds = ids("venue_id"),
    reviewIds = ids("review_id");
  const placeholders = (values: string[]) => values.map(() => "?").join(",");
  const result = await db().batch([
    db()
      .prepare(
        `SELECT id,name,bio,color,avatar,demo FROM profiles WHERE id IN (${placeholders(peopleIds)})`,
      )
      .bind(...peopleIds),
    db()
      .prepare(`SELECT * FROM venues WHERE id IN (${placeholders(venueIds)})`)
      .bind(...venueIds),
    db()
      .prepare(
        `SELECT r.*,p.name,p.color,p.avatar,p.demo,1 AS verified,(SELECT count(*) FROM likes l WHERE l.review_id=r.id AND l.user_id IN (${memberProfileIds})) AS likes FROM reviews r JOIN profiles p ON p.id=r.user_id WHERE r.id IN (${placeholders(reviewIds) || "NULL"})`,
      )
      .bind(...reviewIds),
  ]);
  const people = result[0].results as unknown as Person[];
  const venues = result[1].results as unknown as Venue[];
  const reviews = result[2].results as unknown as Review[];
  const items: FeedItem[] = page.flatMap((row) => {
    const person = people.find((p) => p.id === row.user_id);
    const venue = venues.find((v) => v.id === row.venue_id);
    const review = reviews.find((r) => r.id === row.review_id);
    return person && venue && (row.type !== "review" || review)
      ? [
          {
            id: row.id,
            type: row.type,
            occurred_at: row.occurred_at,
            visit_count: row.visit_count,
            person,
            venue,
            ...(review ? { review } : {}),
          },
        ]
      : [];
  });
  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      rows.length > PAGE_SIZE
        ? btoa(JSON.stringify({ at: last.occurred_at, id: last.id }))
        : null,
  };
}
