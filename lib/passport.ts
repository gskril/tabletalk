import { sessionAccess, RefreshPending, ReconnectRequired } from "./session-access";
import { waitUntil } from "cloudflare:workers";
import { cookies } from "next/headers";
import { db } from "./data";
import { hash } from "./auth";
import { syncVisits, syncMemberAvatar } from "./flynet";
import { authDiagnostic } from "./auth-diagnostics";
import type { Passport } from "./types";

type SyncRow = { status: string; synced_at: number | null; next_attempt_at: number; complete: number };
const FRESH_MS = 15 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;

/** Called only for the authenticated member; returns no credential or raw history. */
export async function memberPassport(userId: string, retry = false): Promise<Passport> {
  const token = (await cookies()).get("tt_session")?.value;
  const time = Date.now();
  const saved = await db().prepare("SELECT status,synced_at,next_attempt_at,complete FROM passport_syncs WHERE user_id=?")
    .bind(userId).first<SyncRow>();
  const sessionHash = token ? await hash(token) : "";
  const session = token ? await db().prepare(
    "SELECT token,token_expires_at,refresh_token FROM sessions WHERE hash=? AND user_id=? AND expires_at>?",
  ).bind(sessionHash, userId, time).first<{ token: string | null; token_expires_at: number | null; refresh_token: string | null }>() : null;
  const status = (value: Passport["status"]): Passport => ({ status: value, syncedAt: saved?.synced_at || null, complete: saved?.complete !== 0 });
  if (!session?.token || ((!session.token_expires_at || session.token_expires_at <= time) && !session.refresh_token))
    return status("reconnect");
  if (saved?.status === "reconnect" && !session.refresh_token) return status("reconnect");
  const renew = !!session.refresh_token && ((session.token_expires_at || 0) <= time + 60000 || saved?.status === "reconnect");
  if (saved && saved.next_attempt_at > time && !(retry && saved.status === "error") && !(renew && ["ready", "reconnect"].includes(saved.status)))
    return status(saved.status as Passport["status"]);

  const lease = crypto.randomUUID();
  const claimed = await db().prepare(
    "INSERT INTO passport_syncs(user_id,status,next_attempt_at,lease_token) VALUES(?,'syncing',?,?) ON CONFLICT(user_id) DO UPDATE SET status='syncing',next_attempt_at=excluded.next_attempt_at,lease_token=excluded.lease_token WHERE passport_syncs.next_attempt_at<=? OR (?=1 AND passport_syncs.status='error') OR (?=1 AND passport_syncs.status IN ('ready','reconnect')) RETURNING lease_token",
  ).bind(userId,time + LEASE_MS,lease,time,retry ? 1 : 0,renew ? 1 : 0).first();
  if (claimed) {
    waitUntil((async () => {
      try {
        const accessToken = await sessionAccess(sessionHash,userId,saved?.status === "reconnect");
        const [result] = await Promise.all([
          syncVisits(userId, accessToken),
          // A photo outage must not prevent importing verified visits.
          syncMemberAvatar(userId, accessToken).catch(error => {
            console.warn("Blackbird avatar sync failed", authDiagnostic(error));
          }),
        ]);
        const finished = Date.now();
        await db().prepare(
          "UPDATE passport_syncs SET status='ready',synced_at=?,next_attempt_at=?,lease_token='',complete=? WHERE user_id=? AND lease_token=?",
        ).bind(finished,finished + FRESH_MS,result.complete ? 1 : 0,userId,lease).run();
      } catch (error) {
        const diagnostic = authDiagnostic(error);
        const reconnect = error instanceof ReconnectRequired || diagnostic.status === 401 || diagnostic.kind === "insufficient_scope";
        const pending = error instanceof RefreshPending;
        await db().prepare(
          "UPDATE passport_syncs SET status=?,next_attempt_at=?,lease_token='' WHERE user_id=? AND lease_token=?",
        ).bind(pending ? "syncing" : reconnect ? "reconnect" : "error",Date.now() + (pending ? 2000 : 5 * 60 * 1000),userId,lease).run();
        console.warn("Blackbird visit sync failed", diagnostic);
      }
    })());
  }
  return status("syncing");
}
