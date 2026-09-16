import { enrichedVenue } from "@/lib/restaurant-labels";
import { db, memberProfileIds, memberListIds } from "@/lib/data";
import { currentUser, failure } from "@/lib/auth";
import { integrationStatus } from "@/lib/flynet";
import { verifiedVisitFrom } from "@/lib/review-eligibility";
import { publicCatalog } from "@/lib/catalog-cache";
import { memberPassport } from "@/lib/passport";
import type { Person, Venue } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET(request?: Request) {
  const started = performance.now();
  try {
    // Keep the full response for older clients; the app caches restaurant data separately.
    const includeCatalog =
      !request ||
      new URL(request.url).searchParams.get("catalog") !== "separate";
    const [catalog, me] = await Promise.all([
      includeCatalog ? publicCatalog() : Promise.resolve(null),
      currentUser(),
    ]);
    const passport = me ? await memberPassport(me.id) : null;
    const uid = me?.id || "";
    // NULL means this older visit proof has not had its check-in history synced
    // yet. Never manufacture a count of one from the old last-visit row.
    const visitCountSql =
      "NULLIF((SELECT count(*) FROM visit_checkins c WHERE c.user_id=v.user_id AND c.venue_id=v.venue_id),0) AS visit_count";
    const query = (sql: string, ...args: unknown[]) =>
      db()
        .prepare(sql)
        .bind(...args);
    const [
      peopleRows,
      reviews,
      lists,
      items,
      saved,
      bookmarks,
      following,
      likes,
      visits,
      publicVisits,
      venues,
    ] = (
      await db().batch<Record<string, unknown>>([
        query(
          `SELECT id,name,bio,color,avatar,demo FROM profiles WHERE id IN (${memberProfileIds})`,
        ),
        query(
          `SELECT r.*,p.name,p.color,p.avatar,p.demo,1 AS verified,(SELECT count(*) FROM likes l WHERE l.review_id=r.id AND l.user_id IN (${memberProfileIds})) AS likes FROM reviews r JOIN profiles p ON p.id=r.user_id WHERE EXISTS(SELECT 1 ${verifiedVisitFrom} AND v.user_id=r.user_id AND v.venue_id=r.venue_id) ORDER BY r.created_at DESC`,
        ),
        query(
          `SELECT l.*,(SELECT count(*) FROM saved_lists s WHERE s.list_id=l.id AND s.user_id IN (${memberProfileIds})) AS saves FROM lists l WHERE l.id IN (${memberListIds}) AND (l.visibility='public' OR l.user_id=?) ORDER BY l.created_at DESC`,
          uid,
        ),
        query(
          `SELECT i.* FROM list_items i JOIN lists l ON l.id=i.list_id JOIN venues v ON v.id=i.venue_id WHERE l.id IN (${memberListIds}) AND v.source!='demo' AND (l.visibility='public' OR l.user_id=?) ORDER BY i.position`,
          uid,
        ),
        query(
          `SELECT s.list_id FROM saved_lists s JOIN lists l ON l.id=s.list_id WHERE l.id IN (${memberListIds}) AND s.user_id=? AND (l.visibility='public' OR l.user_id=?)`,
          uid,
          uid,
        ),
        query(
          "SELECT b.venue_id FROM bookmarks b JOIN venues v ON v.id=b.venue_id WHERE b.user_id=? AND v.source!='demo'",
          uid,
        ),
        query(
          `SELECT target_id FROM follows WHERE user_id=? AND target_id IN (${memberProfileIds})`,
          uid,
        ),
        query("SELECT review_id FROM likes WHERE user_id=?", uid),
        query(
          `SELECT v.venue_id,v.visited_at,${visitCountSql} ${verifiedVisitFrom} AND v.user_id=?`,
          uid,
        ),
        query(
          `SELECT v.user_id,v.venue_id,${visitCountSql} ${verifiedVisitFrom} ORDER BY v.user_id,v.venue_id`,
        ),
        ...(includeCatalog
          ? [
              query(
                "SELECT * FROM venues WHERE source!='demo' ORDER BY source DESC,name",
              ),
            ]
          : []),
      ])
    ).map((result) => result.results);
    const people = peopleRows as unknown as Person[];
    const visitCounts = new Map<string, number>();
    for (const visit of publicVisits)
      visitCounts.set(
        String(visit.user_id),
        (visitCounts.get(String(visit.user_id)) || 0) + 1,
      );
    const rankedPeople = people
      .map((p) => ({ ...p, visited_count: visitCounts.get(String(p.id)) || 0 }))
      .sort(
        (a, b) =>
          b.visited_count - a.visited_count ||
          String(a.name).localeCompare(String(b.name)) ||
          String(a.id).localeCompare(String(b.id)),
      );
    const rankedLists = [...lists].sort(
      (a, b) =>
        (visitCounts.get(String(b.user_id)) || 0) -
          (visitCounts.get(String(a.user_id)) || 0) ||
        String(b.created_at).localeCompare(String(a.created_at)) ||
        String(a.id).localeCompare(String(b.id)),
    );
    return Response.json(
      {
        me,
        passport,
        ...(includeCatalog
          ? {
              venues: (venues as unknown as Venue[]).map(enrichedVenue),
              catalog,
            }
          : {}),
        people: rankedPeople,
        reviews,
        lists: rankedLists,
        items,
        saved: saved.map((x) => x.list_id),
        bookmarks: bookmarks.map((x) => x.venue_id),
        following: following.map((x) => x.target_id),
        likes: likes.map((x) => x.review_id),
        visits,
        publicVisits,
        integration: integrationStatus(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Server-Timing": `state;dur=${(performance.now() - started).toFixed(1)}`,
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
