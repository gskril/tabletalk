import { currentUser, failure } from "@/lib/auth";
import { activityFeed } from "@/lib/feed";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const me = await currentUser();
    return Response.json(
      await activityFeed(me?.id || null, new URL(request.url).searchParams),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
