import { all, memberProfileIds, memberListIds } from "@/lib/data";
import { currentUser, failure } from "@/lib/auth";
import { integrationStatus } from "@/lib/flynet";
import { verifiedVisitFrom } from "@/lib/review-eligibility";
import { publicCatalog } from "@/lib/catalog-cache";
import { memberPassport } from "@/lib/passport";
import type { Person } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const catalog = await publicCatalog();
    const me = await currentUser();
    const passport = me ? await memberPassport(me.id) : null;
    const uid = me?.id || "";
    const [
      venues,
      people,
      reviews,
      lists,
      items,
      saved,
      bookmarks,
      following,
      likes,
      visits,
      publicVisits,
    ] = await Promise.all([
      all("SELECT * FROM venues WHERE source!='demo' ORDER BY source DESC,name"),
      all<Person>(`SELECT id,name,bio,color,demo FROM profiles WHERE id IN (${memberProfileIds})`),
      all(
        `SELECT r.*,p.name,p.color,p.demo,1 AS verified,(SELECT count(*) FROM likes l WHERE l.review_id=r.id AND l.user_id IN (${memberProfileIds})) AS likes FROM reviews r JOIN profiles p ON p.id=r.user_id WHERE EXISTS(SELECT 1 ${verifiedVisitFrom} AND v.user_id=r.user_id AND v.venue_id=r.venue_id) ORDER BY r.created_at DESC`,
      ),
      all(
        `SELECT l.*,(SELECT count(*) FROM saved_lists s WHERE s.list_id=l.id AND s.user_id IN (${memberProfileIds})) AS saves FROM lists l WHERE l.id IN (${memberListIds}) AND (l.visibility='public' OR l.user_id=?) ORDER BY l.created_at DESC`,
        uid,
      ),
      all(
        `SELECT i.* FROM list_items i JOIN lists l ON l.id=i.list_id JOIN venues v ON v.id=i.venue_id WHERE l.id IN (${memberListIds}) AND v.source!='demo' AND (l.visibility='public' OR l.user_id=?) ORDER BY i.position`,
        uid,
      ),
      all(
        `SELECT s.list_id FROM saved_lists s JOIN lists l ON l.id=s.list_id WHERE l.id IN (${memberListIds}) AND s.user_id=? AND (l.visibility='public' OR l.user_id=?)`,
        uid,
        uid,
      ),
      all("SELECT b.venue_id FROM bookmarks b JOIN venues v ON v.id=b.venue_id WHERE b.user_id=? AND v.source!='demo'", uid),
      all(`SELECT target_id FROM follows WHERE user_id=? AND target_id IN (${memberProfileIds})`, uid),
      all("SELECT review_id FROM likes WHERE user_id=?", uid),
      all(
        `SELECT v.venue_id,v.visited_at ${verifiedVisitFrom} AND v.user_id=?`,
        uid,
      ),
      all<{user_id:string; venue_id:string}>(
        `SELECT v.user_id,v.venue_id ${verifiedVisitFrom} ORDER BY v.user_id,v.venue_id`,
      ),
    ]);
    const visitCounts = new Map<string, number>();
    for (const visit of publicVisits)
      visitCounts.set(visit.user_id, (visitCounts.get(visit.user_id) || 0) + 1);
    const rankedPeople = people.map(p => ({...p, visited_count: visitCounts.get(String(p.id)) || 0}))
      .sort((a,b) => b.visited_count - a.visited_count || String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)));
    const rankedLists = [...lists].sort((a,b) =>
      (visitCounts.get(String(b.user_id)) || 0) - (visitCounts.get(String(a.user_id)) || 0)
      || String(b.created_at).localeCompare(String(a.created_at)) || String(a.id).localeCompare(String(b.id)));
    return Response.json(
      {
        me,
        passport,
        venues,
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
        catalog,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
