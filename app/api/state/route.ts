import { extraPhotos } from "@/lib/sample-data";
import { all, seed } from "@/lib/data";
import { currentUser, failure } from "@/lib/auth";
import { integrationStatus } from "@/lib/flynet";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await seed();
    const me = await currentUser();
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
        `SELECT r.*,p.name,p.color,p.demo,EXISTS(SELECT 1 FROM visits v WHERE v.user_id=r.user_id AND v.venue_id=r.venue_id) AS verified,(SELECT count(*) FROM likes l WHERE l.review_id=r.id) AS likes FROM reviews r JOIN profiles p ON p.id=r.user_id ORDER BY r.created_at DESC`,
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
      all("SELECT venue_id,visited_at FROM visits WHERE user_id=?", uid),
    ]);
    return Response.json(
      {
        me,
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
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
