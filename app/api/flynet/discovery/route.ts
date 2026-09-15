import { rateLimit } from "@/lib/rate-limit";
import { currentUser, sameOrigin, AppError, failure } from "@/lib/auth";
import { syncDiscovery } from "@/lib/flynet";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await currentUser();
    if (!u || u.demo)
      throw new AppError(
        "Sign in with a real account to refresh the catalog.",
        401,
      );
    await rateLimit("catalog-sync", 1, 60000);
    return Response.json(await syncDiscovery());
  } catch (e) {
    return failure(e);
  }
}
