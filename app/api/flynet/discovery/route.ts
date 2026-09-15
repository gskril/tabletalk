import { sameOrigin, AppError, failure } from "@/lib/auth";
import { publicCatalog } from "@/lib/catalog-cache";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const catalog = await publicCatalog(false);
    if (!catalog?.syncedAt)
      throw new AppError("The restaurant catalog is being prepared. Please try again shortly.", 503);
    return Response.json({ count: catalog.locationIds.length, complete: true, syncedAt: catalog.syncedAt });
  } catch (e) {
    return failure(e);
  }
}
