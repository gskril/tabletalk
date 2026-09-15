import { extraPhotos } from "@/lib/sample-data";
import { all, seed } from "@/lib/data";
import { currentUser, failure } from "@/lib/auth";
import { integrationStatus } from "@/lib/flynet";
import { verifiedVisitFrom } from "@/lib/review-eligibility";
import { publicCatalog } from "@/lib/catalog-cache";
import { memberPassport } from "@/lib/passport";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await seed();
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
    ] = await Promise.all([
      all("SELECT * FROM venues ORDER BY source DESC,name"),
      all("SELECT id,name,bio,color,demo FROM profiles"),
      all(
        `SELECT r.*,p.name,p.color,p.demo,1 AS verified,(SELECT count(*) FROM likes l WHERE l.review_id=r.id) AS likes FROM reviews r JOIN profiles p ON p.id=r.user_id WHERE EXISTS(SELECT 1 ${verifiedVisitFrom} AND v.user_id=r.user_id AND v.venue_id=r.venue_id) ORDER BY r.created_at DESC`,
      ),
      all(
        "SELECT l.*,(SELECT count(*) FROM saved_lists s WHERE s.list_id=l.id) AS saves FROM lists l WHERE l.visibility='public' OR l.user_id=? ORDER BY l.created_at DESC",
        uid,
      ),
      all(
        "SELECT i.* FROM list_items i JOIN lists l ON l.id=i.list_id WHERE l.visibility='public' OR l.user_id=? ORDER BY i.position",
        uid,
      ),
      all(
        "SELECT s.list_id FROM saved_lists s JOIN lists l ON l.id=s.list_id WHERE s.user_id=? AND (l.visibility='public' OR l.user_id=?)",
        uid,
        uid,
      ),
      all("SELECT venue_id FROM bookmarks WHERE user_id=?", uid),
      all("SELECT target_id FROM follows WHERE user_id=?", uid),
      all("SELECT review_id FROM likes WHERE user_id=?", uid),
      all(
        `SELECT v.venue_id,v.visited_at ${verifiedVisitFrom} AND v.user_id=?`,
        uid,
      ),
    ]);
    return Response.json(
      {
        me,
        passport,
        venues: venues.map((v) =>
          v.source === "demo" && extraPhotos[String(v.name)]
            ? { ...v, image: extraPhotos[String(v.name)] }
            : v,
        ),
        people,
        reviews,
        lists,
        items,
        saved: saved.map((x) => x.list_id),
        bookmarks: bookmarks.map((x) => x.venue_id),
        following: following.map((x) => x.target_id),
        likes: likes.map((x) => x.review_id),
        visits,
        integration: integrationStatus(),
        catalog,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
