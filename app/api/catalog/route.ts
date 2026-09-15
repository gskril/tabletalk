import { all } from "@/lib/data";
import { publicCatalog } from "@/lib/catalog-cache";
import { failure } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Only public restaurant information belongs in this browser/shared cache.
// Member identity, lists, reviews, and check-ins stay in the no-store state API.
export async function GET() {
  try {
    const catalog = await publicCatalog();
    const venues = await all("SELECT * FROM venues WHERE source!='demo' ORDER BY source DESC,name");
    return Response.json({ venues, catalog }, {
      headers: { "Cache-Control": catalog?.syncedAt ? "public, max-age=300" : "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
