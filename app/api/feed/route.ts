import { currentUser, failure } from "@/lib/auth";
import { queueCommunityVisitSync } from "@/lib/passport";
import { activityFeed } from "@/lib/feed";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const me = await currentUser();
    const params = new URL(request.url).searchParams;
    const result = await activityFeed(me?.id || null, params);
    // Validate the feed request before scheduling work. Older pages stay stable.
    const syncing =
      !params.has("cursor") &&
      (await queueCommunityVisitSync().catch(() => {
        // A catch-up scheduling failure must not hide already imported activity.
        console.warn("Blackbird background catch-up could not be queued");
        return false;
      }));
    return Response.json(
      { ...result, syncing },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
