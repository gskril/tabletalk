import { db } from "./data";
import { AppError } from "./auth";
import { authDiagnostic } from "./auth-diagnostics";
import { decryptToken, encryptToken, exchangeRefreshToken } from "./flynet";

export class RefreshPending extends Error {}
export class ReconnectRequired extends AppError {
  constructor() { super("Reconnect Blackbird to restore access.", 401); }
}
type ProviderSession = {
  token: string | null; token_expires_at: number | null; refresh_token: string | null;
};
/** A per-session lease serializes rotating refresh tokens across Worker instances. */
export async function sessionAccess(sessionHash: string, userId: string, force = false): Promise<string> {
  const time = Date.now();
  const session = await db().prepare(
    "SELECT token,token_expires_at,refresh_token FROM sessions WHERE hash=? AND user_id=? AND expires_at>?",
  ).bind(sessionHash,userId,time).first<ProviderSession>();
  if (!session?.token) throw new ReconnectRequired();
  const expires = session.token_expires_at || 0;
  if (!force && expires > time + 60000) return decryptToken(session.token);
  if (!session.refresh_token) {
    if (!force && expires > time) return decryptToken(session.token);
    throw new ReconnectRequired();
  }
  const lease = crypto.randomUUID();
  const claimed = await db().prepare(
    "UPDATE sessions SET refresh_lease=?,refresh_lease_until=? WHERE hash=? AND user_id=? AND expires_at>? AND refresh_lease_until<=? AND refresh_token=? RETURNING hash",
  ).bind(lease,time+60000,sessionHash,userId,time,time,session.refresh_token).first();
  if (!claimed) throw new RefreshPending();
  try {
    const tokens = await exchangeRefreshToken(await decryptToken(session.refresh_token));
    if (typeof tokens.access_token !== "string" || !tokens.access_token ||
        typeof tokens.refresh_token !== "string" || !tokens.refresh_token ||
        typeof tokens.expires_in !== "number" || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) {
      await db().prepare("UPDATE sessions SET refresh_token=NULL,token_expires_at=0 WHERE hash=? AND refresh_lease=?")
        .bind(sessionHash,lease).run();
      throw new ReconnectRequired();
    }
    // Replace both credentials atomically; never reuse the consumed refresh token.
    const updated = await db().prepare(
      "UPDATE sessions SET token=?,token_expires_at=?,refresh_token=?,refresh_lease='',refresh_lease_until=0 WHERE hash=? AND user_id=? AND expires_at>? AND refresh_lease=? RETURNING hash",
    ).bind(await encryptToken(tokens.access_token),Date.now()+tokens.expires_in*1000,
      await encryptToken(tokens.refresh_token),sessionHash,userId,Date.now(),lease).first();
    if (!updated) throw new ReconnectRequired(); // Logged out or superseded while refreshing.
    return tokens.access_token;
  } catch (error) {
    const diagnostic = authDiagnostic(error);
    if (diagnostic.code === "invalid_grant" || diagnostic.status === 401) {
      await db().prepare("UPDATE sessions SET refresh_token=NULL,token_expires_at=0 WHERE hash=? AND refresh_lease=?")
        .bind(sessionHash,lease).run();
      throw new ReconnectRequired();
    }
    throw error;
  } finally {
    await db().prepare("UPDATE sessions SET refresh_lease='',refresh_lease_until=0 WHERE hash=? AND refresh_lease=?")
      .bind(sessionHash,lease).run();
  }
}
