import Tabletalk from "@/components/tabletalk";
import { db, seed } from "@/lib/data";
import { currentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ path?: string[] }> };
export async function generateMetadata({ params }: Props) {
  const { path = [] } = await params;
  try {
    if (path[0] === "lists" && path[1]) {
      const u = await currentUser();
      const l = await db()
        .prepare(
          "SELECT title,description FROM lists WHERE id=? AND (visibility='public' OR user_id=?)",
        )
        .bind(path[1], u?.id || "")
        .first<{ title: string; description: string }>();
      if (l)
        return { title: `${l.title} · Tabletalk`, description: l.description };
    }
    if (path[0] === "restaurants" && path[1]) {
      const v = await db()
        .prepare("SELECT name,neighborhood FROM venues WHERE id=?")
        .bind(path[1])
        .first<{ name: string; neighborhood: string }>();
      if (v)
        return {
          title: `${v.name} · Tabletalk`,
          description: `Reviews and lists for ${v.name} in ${v.neighborhood}.`,
        };
    }
  } catch {}
  return { title: "Tabletalk — NYC, by taste" };
}
export default async function Page({ params }: Props) {
  const { path = [] } = await params;
  if (
    path.length > 2 ||
    ![
      "",
      "restaurants",
      "lists",
      "feed",
      "saved",
      "profile",
      "me",
      "about",
    ].includes(path[0] || "")
  )
    notFound();
  if ((path[0] === "restaurants" || path[0] === "profile") && !path[1])
    notFound();
  if (path[1]) {
    let found = true;
    try {
      await seed();
      const u = await currentUser();
      if (path[0] === "lists")
        found = !!(await db()
          .prepare(
            "SELECT id FROM lists WHERE id=? AND (visibility='public' OR user_id=?)",
          )
          .bind(path[1], u?.id || "")
          .first());
      else if (path[0] === "restaurants" || path[0] === "profile")
        found = !!(await db()
          .prepare(
            `SELECT id FROM ${path[0] === "restaurants" ? "venues" : "profiles"} WHERE id=?`,
          )
          .bind(path[1])
          .first());
      else found = false;
    } catch {}
    if (!found) notFound();
  }
  return <Tabletalk />;
}
