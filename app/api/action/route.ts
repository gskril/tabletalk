import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { db, now } from "@/lib/data";
import { currentUser, sameOrigin, failure, AppError } from "@/lib/auth";
const id = z.string().min(1).max(100);
const text = (max: number) => z.string().trim().max(max);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bookmark"), venueId: id, active: z.boolean() }),
  z.object({ action: z.literal("follow"), targetId: id, active: z.boolean() }),
  z.object({ action: z.literal("like"), reviewId: id, active: z.boolean() }),
  z.object({ action: z.literal("saveList"), listId: id, active: z.boolean() }),
  z.object({
    action: z.literal("review"),
    venueId: id,
    rating: z.number().min(1).max(10).multipleOf(0.1),
    body: text(2000).min(3),
    dish: text(100),
    visitedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({ action: z.literal("deleteReview"), reviewId: id }),
  z.object({
    action: z.literal("list"),
    listId: id.optional(),
    title: text(80).min(2),
    description: text(500),
    visibility: z.enum(["public", "private"]),
    venueIds: z.array(id).max(100),
  }),
  z.object({ action: z.literal("deleteList"), listId: id }),
  z.object({
    action: z.literal("profile"),
    name: text(40).min(2),
    bio: text(200),
  }),
]);
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new AppError("Send a JSON request.", 415);
    if (Number(req.headers.get("content-length") || 0) > 20000)
      throw new AppError("Request is too large.", 413);
    const raw = await req.text();
    if (raw.length > 20000) throw new AppError("Request is too large.", 413);
    const b = schema.parse(JSON.parse(raw));
    const u = await currentUser();
    if (!u) throw new AppError("Sign in to save your changes.", 401);
    const d = db();
    await rateLimit("write:" + u.id, 120, 60000);
    const exists = async (table: string, key: string, value: string) => {
      if (
        !(await d
          .prepare(`SELECT 1 FROM ${table} WHERE ${key}=?`)
          .bind(value)
          .first())
      )
        throw new AppError("That item is no longer available.", 404);
    };
    const own = async (table: string, value: string) => {
      if (
        !(await d
          .prepare(`SELECT 1 FROM ${table} WHERE id=? AND user_id=?`)
          .bind(value, u.id)
          .first())
      )
        throw new AppError("That item is not available to edit.", 404);
    };
    const relation = async (
      table: string,
      column: string,
      value: string,
      active: boolean,
    ) =>
      d
        .prepare(
          active
            ? `INSERT OR IGNORE INTO ${table}(user_id,${column}) VALUES(?,?)`
            : `DELETE FROM ${table} WHERE user_id=? AND ${column}=?`,
        )
        .bind(u.id, value)
        .run();
    switch (b.action) {
      case "bookmark":
        await exists("venues", "id", b.venueId);
        await relation("bookmarks", "venue_id", b.venueId, b.active);
        break;
      case "follow":
        if (b.targetId === u.id)
          throw new AppError("You cannot follow yourself.");
        await exists("profiles", "id", b.targetId);
        await relation("follows", "target_id", b.targetId, b.active);
        break;
      case "like":
        await exists("reviews", "id", b.reviewId);
        await relation("likes", "review_id", b.reviewId, b.active);
        break;
      case "saveList":
        if (
          !(await d
            .prepare(
              "SELECT 1 FROM lists WHERE id=? AND (visibility='public' OR user_id=?)",
            )
            .bind(b.listId, u.id)
            .first())
        )
          throw new AppError("List not found.", 404);
        await relation("saved_lists", "list_id", b.listId, b.active);
        break;
      case "review": {
        await exists("venues", "id", b.venueId);
        const date = new Date(b.visitedAt + "T12:00:00Z");
        if (
          !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== b.visitedAt ||
          b.visitedAt > now().slice(0, 10)
        )
          throw new AppError(
            "Choose a valid visit date that is not in the future.",
          );
        await d
          .prepare(
            "INSERT INTO reviews(id,user_id,venue_id,rating,body,dish,visited_at,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,venue_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,dish=excluded.dish,visited_at=excluded.visited_at",
          )
          .bind(
            crypto.randomUUID(),
            u.id,
            b.venueId,
            b.rating,
            b.body,
            b.dish,
            b.visitedAt,
            now(),
          )
          .run();
        break;
      }
      case "deleteReview":
        await own("reviews", b.reviewId);
        await d
          .prepare("DELETE FROM reviews WHERE id=? AND user_id=?")
          .bind(b.reviewId, u.id)
          .run();
        break;
      case "list": {
        const listId = b.listId || crypto.randomUUID();
        if (b.listId) await own("lists", listId);
        const ids = [...new Set(b.venueIds)];
        for (const v of ids) await exists("venues", "id", v);
        const stmts = [
          b.listId
            ? d
                .prepare(
                  "UPDATE lists SET title=?,description=?,visibility=? WHERE id=? AND user_id=?",
                )
                .bind(b.title, b.description, b.visibility, listId, u.id)
            : d
                .prepare(
                  "INSERT INTO lists(id,user_id,title,description,visibility,color,created_at) VALUES(?,?,?,?,?,?,?)",
                )
                .bind(
                  listId,
                  u.id,
                  b.title,
                  b.description,
                  b.visibility,
                  "#f5ce4f",
                  now(),
                ),
          d.prepare("DELETE FROM list_items WHERE list_id=?").bind(listId),
          ...ids.map((v, i) =>
            d
              .prepare(
                "INSERT INTO list_items(list_id,venue_id,position) VALUES(?,?,?)",
              )
              .bind(listId, v, i),
          ),
        ];
        await d.batch(stmts);
        return Response.json({ ok: true, id: listId });
      }
      case "deleteList":
        await own("lists", b.listId);
        await d
          .prepare("DELETE FROM lists WHERE id=? AND user_id=?")
          .bind(b.listId, u.id)
          .run();
        break;
      case "profile":
        await d
          .prepare("UPDATE profiles SET name=?,bio=? WHERE id=?")
          .bind(b.name, b.bio, u.id)
          .run();
        break;
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return Response.json(
        { error: "Please check the form fields and try again." },
        { status: 400 },
      );
    return failure(e);
  }
}
