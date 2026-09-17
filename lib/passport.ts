import {
  sessionAccess,
  RefreshPending,
  ReconnectRequired,
} from "./session-access";
import { waitUntil } from "cloudflare:workers";
import { cookies } from "next/headers";
import { db } from "./data";
import { hash } from "./auth";
import { settings, syncVisits, syncMemberAvatar } from "./flynet";
import { authDiagnostic } from "./auth-diagnostics";
import type { Passport } from "./types";

type SyncRow = {
  status: string;
  synced_at: number | null;
  next_attempt_at: number;
  complete: number;
};
const FRESH_MS = 15 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;

/** Called only for the authenticated member; returns no credential or raw history. */
export async function memberPassport(
  userId: string,
  retry = false,
): Promise<Passport> {
  const token = (await cookies()).get("tt_session")?.value;
  return syncPassportSession(userId, token ? await hash(token) : "", retry);
}

async function syncPassportSession(
  userId: string,
  sessionHash: string,
  retry = false,
  refreshProfile = true,
): Promise<Passport> {
  const time = Date.now();
  const saved = await db()
    .prepare(
      "SELECT status,synced_at,next_attempt_at,complete FROM passport_syncs WHERE user_id=?",
    )
    .bind(userId)
    .first<SyncRow>();
  const session = sessionHash
    ? await db()
        .prepare(
          "SELECT token,token_expires_at,refresh_token FROM sessions WHERE hash=? AND user_id=? AND expires_at>?",
        )
        .bind(sessionHash, userId, time)
        .first<{
          token: string | null;
          token_expires_at: number | null;
          refresh_token: string | null;
        }>()
    : null;
  const status = (value: Passport["status"]): Passport => ({
    status: value,
    syncedAt: saved?.synced_at || null,
    complete: saved?.complete !== 0,
  });
  if (
    !session?.token ||
    ((!session.token_expires_at || session.token_expires_at <= time) &&
      !session.refresh_token)
  )
    return status("reconnect");
  if (saved?.status === "reconnect" && !session.refresh_token)
    return status("reconnect");
  const renew =
    !!session.refresh_token &&
    ((session.token_expires_at || 0) <= time + 60000 ||
      saved?.status === "reconnect");
  const force =
    retry &&
    !!saved &&
    (saved.status === "error" ||
      (saved.status === "ready" && (saved.synced_at || 0) <= time - 30000));
  if (
    saved &&
    saved.next_attempt_at > time &&
    !force &&
    !(renew && ["ready", "reconnect"].includes(saved.status))
  )
    return status(saved.status as Passport["status"]);

  const lease = crypto.randomUUID();
  const claimed = await db()
    .prepare(
      "INSERT INTO passport_syncs(user_id,status,next_attempt_at,lease_token) VALUES(?,'syncing',?,?) ON CONFLICT(user_id) DO UPDATE SET status='syncing',next_attempt_at=excluded.next_attempt_at,lease_token=excluded.lease_token WHERE passport_syncs.next_attempt_at<=? OR (?=1 AND passport_syncs.status IN ('error','ready')) OR (?=1 AND passport_syncs.status IN ('ready','reconnect')) RETURNING lease_token",
    )
    .bind(userId, time + LEASE_MS, lease, time, force ? 1 : 0, renew ? 1 : 0)
    .first();
  if (claimed) {
    waitUntil(
      (async () => {
        try {
          const accessToken = await sessionAccess(
            sessionHash,
            userId,
            saved?.status === "reconnect",
          );
          const [result] = await Promise.all([
            syncVisits(userId, accessToken),
            // A photo outage must not prevent importing verified visits.
            refreshProfile
              ? syncMemberAvatar(userId, accessToken).catch((error) => {
                  console.warn(
                    "Blackbird avatar sync failed",
                    authDiagnostic(error),
                  );
                })
              : Promise.resolve(),
          ]);
          const finished = Date.now();
          await db()
            .prepare(
              "UPDATE passport_syncs SET status='ready',synced_at=?,next_attempt_at=?,lease_token='',complete=? WHERE user_id=? AND lease_token=?",
            )
            .bind(
              finished,
              finished + FRESH_MS,
              result.complete ? 1 : 0,
              userId,
              lease,
            )
            .run();
        } catch (error) {
          const diagnostic = authDiagnostic(error);
          const reconnect =
            error instanceof ReconnectRequired ||
            diagnostic.status === 401 ||
            diagnostic.kind === "insufficient_scope";
          const pending = error instanceof RefreshPending;
          await db()
            .prepare(
              "UPDATE passport_syncs SET status=?,next_attempt_at=?,lease_token='' WHERE user_id=? AND lease_token=?",
            )
            .bind(
              pending ? "syncing" : reconnect ? "reconnect" : "error",
              Date.now() + (pending ? 2000 : 5 * 60 * 1000),
              userId,
              lease,
            )
            .run();
          console.warn("Blackbird visit sync failed", diagnostic);
        }
      })(),
    );
  }
  return status("syncing");
}

/** Traffic-triggered catch-up: bounded, oldest-first, with the same per-member
 * leases as interactive sync. No browser cookie or member presence is required.
 * This is deliberately not described as a clock-based scheduled job.
 */
export async function queueCommunityVisitSync(): Promise<boolean> {
  const time = Date.now();
  const candidates = await db()
    .prepare(
      `
    SELECT p.id, (SELECT s.hash FROM sessions s WHERE s.user_id=p.id
      AND s.expires_at>? AND s.token IS NOT NULL
      AND (s.refresh_token IS NOT NULL OR s.token_expires_at>?)
      ORDER BY (s.refresh_token IS NOT NULL) DESC,s.token_expires_at DESC LIMIT 1) AS session_hash
    FROM profiles p LEFT JOIN passport_syncs ps ON ps.user_id=p.id
    WHERE p.demo=0 AND p.external_id LIKE ?
      AND (ps.next_attempt_at IS NULL OR ps.next_attempt_at<=?)
      AND session_hash IS NOT NULL
    ORDER BY COALESCE(ps.next_attempt_at,0),p.id LIMIT 3
  `,
    )
    .bind(time, time, settings().environment + ":_%", time)
    .all<{ id: string; session_hash: string }>();
  await Promise.all(
    candidates.results.map((p) =>
      syncPassportSession(p.id, p.session_hash, false, false),
    ),
  );
  const pending = await db()
    .prepare(
      "SELECT 1 AS pending FROM passport_syncs WHERE status='syncing' AND next_attempt_at>? LIMIT 1",
    )
    .bind(time)
    .first();
  return !!pending;
}
