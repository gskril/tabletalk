import { waitUntil } from "cloudflare:workers";
import { db } from "./data";
import { settings, syncDiscovery } from "./flynet";

const FRESH_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
type Snapshot = { location_ids: string; synced_at: number; next_attempt_at: number };

async function snapshot(environment: string) {
  return db().prepare("SELECT location_ids,synced_at,next_attempt_at FROM catalog_cache WHERE environment=?")
    .bind(environment).first<Snapshot>();
}

/** A durable shared snapshot; no member token or private data enters this cache. */
export async function publicCatalog(background = true) {
  const { apiKey, environment } = settings();
  if (!apiKey) return null;
  // Invalidate older city-name-only snapshots when the coverage rules change.
  const previousKey = `${environment}:nyc-postal-v2`;
  const cacheKey = `${environment}:restaurant-names-v3`;
  let saved = await snapshot(cacheKey);
  const time = Date.now();
  if (!saved || saved.next_attempt_at <= time) {
    const token = crypto.randomUUID();
    // One refresh across Worker isolates, with recovery if a Worker is stopped.
    const claimed = await db().prepare(
      "INSERT INTO catalog_cache(environment,lease_token,next_attempt_at) VALUES(?,?,?) ON CONFLICT(environment) DO UPDATE SET lease_token=excluded.lease_token,next_attempt_at=excluded.next_attempt_at WHERE catalog_cache.next_attempt_at<=? RETURNING lease_token",
    ).bind(cacheKey,token,time + LEASE_MS,time).first<{ lease_token: string }>();
    if (claimed) {
      const refresh = async () => {
        try {
          const result = await syncDiscovery();
          if (!result.complete) throw new Error("Catalog import exceeded its page limit");
          const completedAt = Date.now();
          await db().prepare(
            "UPDATE catalog_cache SET location_ids=?,synced_at=?,next_attempt_at=?,lease_token='' WHERE environment=? AND lease_token=?",
          ).bind(JSON.stringify(result.locationIds),completedAt,completedAt + FRESH_MS,cacheKey,token).run();
        } catch {
          // Retain the last complete snapshot and back off during provider outages.
          await db().prepare(
            "UPDATE catalog_cache SET next_attempt_at=?,lease_token='' WHERE environment=? AND lease_token=?",
          ).bind(Date.now() + RETRY_MS,cacheKey,token).run();
          console.warn("Blackbird catalog refresh failed; retaining saved catalog.");
        }
      };
      if (saved?.synced_at && background) waitUntil(refresh());
      else {
        await refresh();
        saved = await snapshot(cacheKey);
      }
    } else saved = await snapshot(cacheKey);
  }
  // Keep the last successful older snapshot available if the first new import fails.
  if (!saved?.synced_at) saved = await snapshot(previousKey) || await snapshot(environment);
  return {
    locationIds: JSON.parse(saved?.location_ids || "[]") as string[],
    syncedAt: saved?.synced_at || null,
  };
}
