"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
function Link(
  props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string },
) {
  return <a {...props} />;
}
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Heart,
  Link2,
  Lock,
  MapPin,
  Map as MapIcon,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Utensils,
  X,
  LogOut,
  ExternalLink,
  Grid2X2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import { OCCASION_LABELS, occasionLabels } from "@/lib/occasion-labels";
import { avatarUrl } from "@/lib/avatar";
import type {
  State,
  Venue,
  Person,
  Review,
  DiningList,
  FeedItem,
} from "@/lib/types";
import DiningMap from "@/components/dining-map";
import FriendsFeed from "@/components/friends-feed";
import RestaurantImage from "@/components/restaurant-image";
import ConfirmDialog from "@/components/confirm-dialog";
type Modal =
  | { type: "login" }
  | { type: "review"; venue: Venue }
  | { type: "list"; list?: DiningList; add?: string }
  | { type: "profile" }
  | { type: "confirm"; title: string; run: () => Promise<void> }
  | null;
const verifiedVisitLabel = (count?: number | null) =>
  count ? `${count} verified ${count === 1 ? "visit" : "visits"}` : "Visited";
const safeUrl = (s: string) => (/^https?:\/\//.test(s) ? s : "#");
const initials = (s: string) =>
  s
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
function Avatar({
  person,
  large = false,
}: {
  person: Pick<Person, "name" | "color" | "avatar">;
  large?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  const photo = avatarUrl(person.avatar);
  return (
    <span className={`avatar ${large ? "large" : ""}`} aria-hidden="true">
      {photo && failedUrl !== photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(photo)}
        />
      ) : (
        initials(person.name)
      )}
    </span>
  );
}
function Filter({
  value,
  onChange,
  placeholder,
  values,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  values: string[];
}) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" ? "" : v)}
    >
      <SelectTrigger className="filter-select" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {values.map((x) => (
          <SelectItem key={x} value={x}>
            {x}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}
export default function Tabletalk() {
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [modal, setModal] = useState<Modal>(null),
    [busy, setBusy] = useState(false);
  const path = usePathname(),
    params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || ""),
    [neighborhood, setNeighborhood] = useState(
      params.get("neighborhood") || "",
    ),
    [cuisine, setCuisine] = useState(params.get("cuisine") || ""),
    [price, setPrice] = useState(params.get("price") || ""),
    [occasion, setOccasion] = useState(""),
    [mapView, setMapView] = useState(false),
    [friendSearch, setFriendSearch] = useState(""),
    [savedTab, setSavedTab] = useState(
      ["places", "visits", "lists"].includes(params.get("tab") || "")
        ? params.get("tab")!
        : "places",
    ),
    [profileTab, setProfileTab] = useState("visits");
  const [visibleCount, setVisibleCount] = useState(24);
  useEffect(
    () => setVisibleCount(24),
    [query, neighborhood, cuisine, price, occasion],
  );
  const load = useCallback(async () => {
    try {
      const [r, catalogResponse] = await Promise.all([
        fetch("/api/state?catalog=separate"),
        fetch("/api/catalog"),
      ]);
      const d = (await r.json()) as State & { error?: string };
      if (!r.ok) throw new Error(d.error);
      let catalog = (await catalogResponse.json()) as Pick<
        State,
        "venues" | "catalog"
      > & { error?: string };
      if (!catalogResponse.ok) throw new Error(catalog.error);
      // A new visit can introduce an older restaurant outside the discovery catalog.
      const known = new Set(catalog.venues.map((v: Venue) => v.id));
      if (
        [...d.visits, ...d.publicVisits, ...d.items].some(
          (v) => !known.has(v.venue_id),
        )
      ) {
        const fresh = await fetch("/api/catalog", { cache: "reload" });
        if (fresh.ok) catalog = (await fresh.json()) as typeof catalog;
      }
      setData({ ...d, ...catalog });
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load your notebook.",
      );
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!data?.me?.id) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 15 * 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [data?.me?.id, load]);
  useEffect(() => {
    if (data?.passport?.status !== "syncing") return;
    const timer = window.setTimeout(load, 1500);
    return () => window.clearTimeout(timer);
  }, [data, load]);
  useEffect(() => {
    const authError = params.get("auth_error");
    if (authError) {
      const messages: Record<string, string> = {
        state:
          "The sign-in session could not be verified. Start again in the same browser.",
        expired:
          "This sign-in link has expired or was already used. Please reconnect.",
        token:
          "Blackbird could not complete the sign-in exchange. Please reconnect.",
        token_response:
          "Blackbird returned an unexpected sign-in response. Please try again.",
        profile: "We couldn't load your Blackbird profile. Please reconnect.",
      };
      const reference = params.get("auth_ref");
      toast.error(
        (messages[authError] ||
          "Blackbird connection did not complete. Please reconnect.") +
          (reference && /^[a-f0-9]{8}$/.test(reference)
            ? ` Reference: ${reference}.`
            : ""),
        { duration: 15000 },
      );
    }
    if (params.get("connected"))
      toast.success("Blackbird connected. Your visits sync automatically.");
  }, [params]);
  async function action(body: Record<string, unknown>) {
    const r = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await r.json()) as { id?: string; error?: string };
    if (!r.ok) throw new Error(d.error);
    await load();
    return d;
  }
  async function quick(body: Record<string, unknown>, message?: string) {
    if (!data?.me) {
      setModal({ type: "login" });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await action(body);
      if (message) toast.success(message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function authThen(m: Modal) {
    setModal(data?.me ? m : { type: "login" });
  }
  function go(to: string) {
    window.location.assign(to);
  }
  const venueById = useMemo(
    () => new Map(data?.venues.map((v) => [v.id, v])),
    [data?.venues],
  );
  const reviewsByVenue = useMemo(() => {
    const grouped = new Map<string, Review[]>();
    for (const review of data?.reviews || []) {
      const group = grouped.get(review.venue_id) || [];
      group.push(review);
      grouped.set(review.venue_id, group);
    }
    return grouped;
  }, [data?.reviews]);
  if (!data)
    return (
      <>
        <header className="topbar">
          <Link className="brand" href="/">
            tabletalk
          </Link>
        </header>
        <main className="shell">
          {error ? (
            <Empty
              title="We couldn't set the table"
              body={error}
              action={
                <button className="btn primary" onClick={load}>
                  Try again
                </button>
              }
            />
          ) : (
            <div
              className="loading"
              role="status"
              aria-label="Loading Tabletalk"
            >
              <span />
            </div>
          )}
        </main>
      </>
    );
  const d = data,
    me = d.me;
  const venue = (id: string) => venueById.get(id);
  const person = (id: string) => d.people.find((p) => p.id === id);
  const publicVisits = d.publicVisits || [];
  const listVenues = (id: string) =>
    d.items
      .filter((i) => i.list_id === id)
      .map((i) => venue(i.venue_id))
      .filter((v): v is Venue => !!v);
  const average = (id: string) => {
    const r = reviewsByVenue.get(id) || [];
    return r.length
      ? (r.reduce((a, r) => a + r.rating, 0) / r.length).toFixed(1)
      : null;
  };
  const score = (id: string) => (
    <span
      className={`score ${average(id) ? "" : "none"}`}
      aria-label={average(id) ? `Rating ${average(id)} out of 10` : "Not rated"}
    >
      {average(id) || "New"}
    </span>
  );
  const bookmark = (v: Venue) => (
    <button
      className={`icon-btn ${d.bookmarks.includes(v.id) ? "selected" : ""}`}
      aria-label={`${d.bookmarks.includes(v.id) ? "Unsave" : "Save"} ${v.name}`}
      disabled={busy}
      onClick={() =>
        quick(
          {
            action: "bookmark",
            venueId: v.id,
            active: !d.bookmarks.includes(v.id),
          },
          d.bookmarks.includes(v.id)
            ? "Removed from Saved places"
            : "Saved to your notebook",
        )
      }
    >
      <Bookmark
        size={17}
        fill={d.bookmarks.includes(v.id) ? "currentColor" : "none"}
      />
    </button>
  );
  function card(v: Venue) {
    const rev = reviewsByVenue.get(v.id) || [];
    return (
      <article className="venue-card" key={v.id}>
        <div className="venue-image">
          <Link href={`/restaurants/${v.id}`} aria-label={`View ${v.name}`}>
            <RestaurantImage venue={v} />
          </Link>
          {bookmark(v)}
        </div>
        <div className="venue-body">
          <div className="venue-title">
            <Link href={`/restaurants/${v.id}`}>
              <h3>{v.name}</h3>
            </Link>
            {average(v.id) && score(v.id)}
          </div>
          <p className="venue-meta">
            {v.neighborhood} · {v.cuisine} · {"$".repeat(v.price)}
          </p>
          <div className="card-footer">
            <div className="actions" style={{ gap: 0 }}>
              {rev.slice(0, 3).map((r) => (
                <Avatar key={r.id} person={r} />
              ))}
              <span
                className="small muted"
                style={{ marginLeft: rev.length ? 7 : 0 }}
              >
                {rev.length
                  ? `${rev.length} ${rev.length === 1 ? "review" : "reviews"}`
                  : "No reviews yet"}
              </span>
            </div>
            <Link
              className="small"
              href={`/restaurants/${v.id}`}
              aria-label={`Details for ${v.name}`}
            >
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </article>
    );
  }
  function listCard(l: DiningList) {
    const p = person(l.user_id);
    const vs = listVenues(l.id);
    return (
      <Link href={`/lists/${l.id}`} className="list-card" key={l.id}>
        {vs.length > 0 ? (
          <div className="list-cover">
            {vs.slice(0, 3).map((v) => (
              <RestaurantImage key={v.id} venue={v} compact />
            ))}
          </div>
        ) : (
          <div className="list-cover list-cover-empty" aria-hidden="true">
            Your next few places.
          </div>
        )}
        <div className="eyebrow">
          {l.visibility === "private" ? "Private collection" : "Public list"}
        </div>
        <h3>{l.title}</h3>
        <p>{l.description}</p>
        <div className="byline">
          {p && <Avatar person={p} />}
          <span>
            {p?.name || "A diner"} · {vs.length} spots
            <br />
            {p?.visited_count || 0} verified places visited{" "}
            {p?.demo ? <span className="demo-tag">Demo</span> : null}
          </span>
        </div>
      </Link>
    );
  }
  function activityCard(item: FeedItem) {
    const v = item.venue;
    const review = item.review
      ? d.reviews.find((r) => r.id === item.review!.id) || item.review
      : undefined;
    const saved = d.bookmarks.includes(v.id);
    return (
      <article
        className="feed-card"
        key={item.id}
        data-activity-type={item.type}
      >
        <div className="feed-card-head">
          <Link
            href={`/profile/${item.person.id}`}
            aria-label={`View ${item.person.name}'s profile`}
          >
            <Avatar person={item.person} />
          </Link>
          <div>
            <Link href={`/profile/${item.person.id}`}>
              <strong>{item.person.name}</strong>
            </Link>
            <p>{item.type === "review" ? "shared a review" : "checked in"}</p>
          </div>
          <time dateTime={item.occurred_at}>
            {new Date(item.occurred_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "America/New_York",
            })}
          </time>
        </div>
        <Link
          href={`/restaurants/${v.id}`}
          className="feed-restaurant-photo"
          aria-label={`View ${v.name}`}
        >
          <RestaurantImage venue={v} />
        </Link>
        <div className="feed-card-body">
          <div className="feed-place-heading">
            <Link href={`/restaurants/${v.id}`}>
              <h2>{v.name}</h2>
            </Link>
            {review && (
              <span
                className="score"
                aria-label={`Rating ${review.rating} out of 10`}
              >
                {review.rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="small muted">
            {v.neighborhood} · {v.cuisine}
          </p>
          <p className="small muted">{v.address}</p>
          <p className="verified">
            <CheckCircle2 size={14} />
            {item.type === "checkin" && item.visit_count
              ? verifiedVisitLabel(item.visit_count)
              : "Blackbird visit verified"}
          </p>
          {review && (
            <>
              <p className="feed-review-body">{review.body}</p>
              {review.dish && (
                <p className="review-dish">
                  <Utensils size={14} /> Order this: {review.dish}
                </p>
              )}
            </>
          )}
          <div className="feed-card-actions">
            <button
              className={`btn ${saved ? "saved-place" : "primary"}`}
              aria-label={`${saved ? "Unsave" : "Save"} ${v.name}`}
              aria-pressed={saved}
              disabled={busy}
              onClick={() =>
                quick(
                  { action: "bookmark", venueId: v.id, active: !saved },
                  saved ? "Removed from Saved places" : "Saved to My notebook",
                )
              }
            >
              <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "Save place"}
            </button>
            <button
              className="btn"
              onClick={() => authThen({ type: "list", add: v.id })}
            >
              <Plus size={16} />
              Add to list
            </button>
            {review && (
              <button
                className="feed-like"
                disabled={busy}
                aria-label={`${d.likes.includes(review.id) ? "Unlike" : "Like"} review by ${review.name}`}
                onClick={() =>
                  quick({
                    action: "like",
                    reviewId: review.id,
                    active: !d.likes.includes(review.id),
                  })
                }
              >
                <Heart
                  size={16}
                  fill={d.likes.includes(review.id) ? "currentColor" : "none"}
                />
                {review.likes || "Helpful"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }
  function reviewCard(r: Review, showVenue = false) {
    const v = venue(r.venue_id);
    return (
      <article className="review" key={r.id}>
        {showVenue && v && (
          <Link
            className="review-photo"
            href={`/restaurants/${v.id}`}
            aria-label={`View ${v.name}`}
          >
            <RestaurantImage venue={v} />
          </Link>
        )}
        <div className="review-head">
          <Link href={`/profile/${r.user_id}`}>
            <Avatar person={r} />
          </Link>
          <div>
            <Link href={`/profile/${r.user_id}`}>
              <strong className="small">{r.name}</strong>
            </Link>{" "}
            {r.demo ? <span className="demo-tag">Demo</span> : null}
            <div className="small muted">
              {showVenue && v ? (
                <Link href={`/restaurants/${v.id}`}>{v.name} · </Link>
              ) : null}
              {new Date(r.visited_at + "T12:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              )}
            </div>
          </div>
          <span className="score">{r.rating.toFixed(1)}</span>
        </div>
        {r.verified ? (
          <div className="verified">
            <CheckCircle2 size={13} />{" "}
            {v?.source === "staging"
              ? "Staging visit verified"
              : "Blackbird visit verified"}
          </div>
        ) : null}
        <p>{r.body}</p>
        {r.dish && (
          <div className="review-dish">
            <Utensils size={14} />
            <span>Order this: {r.dish}</span>
          </div>
        )}
        <div className="review-actions">
          <button
            disabled={busy}
            onClick={() =>
              quick({
                action: "like",
                reviewId: r.id,
                active: !d.likes.includes(r.id),
              })
            }
            aria-label={`${d.likes.includes(r.id) ? "Unlike" : "Like"} review by ${r.name}`}
          >
            <Heart
              size={16}
              fill={d.likes.includes(r.id) ? "var(--primary)" : "none"}
              color={d.likes.includes(r.id) ? "var(--primary)" : undefined}
            />
            {r.likes || "Helpful"}
          </button>
          {me?.id === r.user_id && v && (
            <>
              <button onClick={() => setModal({ type: "review", venue: v })}>
                Edit review
              </button>
              <button
                onClick={() =>
                  setModal({
                    type: "confirm",
                    title: "Delete this review?",
                    run: async () => {
                      await action({ action: "deleteReview", reviewId: r.id });
                      toast.success("Review deleted");
                    },
                  })
                }
              >
                Delete
              </button>
            </>
          )}
        </div>
      </article>
    );
  }
  function passportBanner() {
    return (
      <div className="banner" style={{ margin: "0 0 25px" }}>
        <div>
          <h3>
            {d.passport?.status === "reconnect"
              ? "Your Blackbird visits"
              : "Blackbird connected"}
          </h3>
          <p>
            {d.passport?.status === "syncing"
              ? "Finding the places you’ve been for your public profile."
              : d.passport?.status === "error"
                ? "We couldn’t update your visits. Your saved visits are still here."
                : d.passport?.status === "reconnect"
                  ? "Reconnect to update your profile photo and latest visits. Your saved data is still here."
                  : d.passport?.complete === false
                    ? "Your visited places synced. Some older visits may still be missing."
                    : "Visited places appear on your public profile. Visit dates are only visible to you."}
          </p>
        </div>
        <div className="actions">
          {d.passport?.status === "reconnect" && (
            <a className="btn" href="/api/auth/blackbird/start">
              Reconnect Blackbird
            </a>
          )}
          {d.passport?.status === "syncing" && (
            <span role="status">Syncing visits…</span>
          )}
          {d.passport?.status === "ready" && (
            <span className="verified">
              <CheckCircle2 size={16} /> Visits synced
            </span>
          )}
          {d.passport?.status === "error" && (
            <button
              className="btn dark"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch("/api/flynet/sync", {
                    method: "POST",
                  });
                  const b = (await r.json()) as {
                    error?: string;
                    count?: number;
                    complete?: boolean;
                  };
                  if (!r.ok) throw new Error(b.error);
                  await load();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Retry sync
            </button>
          )}
        </div>
      </div>
    );
  }
  function visitedPlaces() {
    const visits = [...d.visits].sort((a, b) =>
      b.visited_at.localeCompare(a.visited_at),
    );
    return (
      <>
        {passportBanner()}
        {visits.length ? (
          <div className="visited-places">
            {visits.map((visit) => {
              const v = venue(visit.venue_id);
              if (!v) return null;
              const review = d.reviews.find(
                (r) => r.user_id === me?.id && r.venue_id === v.id,
              );
              return (
                <article className="visit-row" key={v.id}>
                  <Link href={`/restaurants/${v.id}`} className="visit-photo">
                    <RestaurantImage venue={v} compact />
                  </Link>
                  <div className="row-info">
                    <Link href={`/restaurants/${v.id}`}>
                      <h2>{v.name}</h2>
                    </Link>
                    <p className="muted">
                      {v.neighborhood} · {v.cuisine}
                    </p>
                    {visit.visit_count != null && (
                      <p className="verified">
                        {verifiedVisitLabel(visit.visit_count)}
                      </p>
                    )}
                    <p className="small muted">
                      Last visited{" "}
                      {new Date(visit.visited_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "America/New_York",
                      })}
                    </p>
                  </div>
                  <div className="actions">
                    {review && (
                      <span
                        className="score"
                        aria-label={`Your rating ${review.rating} out of 10`}
                      >
                        {review.rating.toFixed(1)}
                      </span>
                    )}
                    <button
                      className="btn"
                      onClick={() => setModal({ type: "review", venue: v })}
                    >
                      {review ? "Edit review" : "Write a review"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            title="Your places, verified"
            body={
              d.passport?.status === "syncing"
                ? "Your Blackbird visits will appear here as they sync."
                : "No NYC visits synced yet. Your Blackbird places will also appear on your public profile."
            }
          />
        )}
      </>
    );
  }
  function row(v: Venue, i: number) {
    return (
      <div className="list-row" key={v.id}>
        <span className="rank">{String(i + 1).padStart(2, "0")}</span>
        <Link href={`/restaurants/${v.id}`} className="row-photo">
          <RestaurantImage venue={v} compact />
        </Link>
        <div className="row-info">
          <Link href={`/restaurants/${v.id}`}>
            <h3>{v.name}</h3>
          </Link>
          <p className="small muted">
            {v.neighborhood} · {v.cuisine} · {"$".repeat(v.price)}
          </p>
        </div>
        {score(v.id)}
        {bookmark(v)}
      </div>
    );
  }
  // Keep existing restaurant-filter links usable after moving discovery.
  const legacyExplore =
    path === "/" &&
    ["q", "neighborhood", "cuisine", "price"].some((key) => params.has(key));
  const active = legacyExplore ? "explore" : path.split("/")[1] || "feed";
  let content: React.ReactNode;
  if (active === "explore") {
    const catalogIds = d.catalog ? new Set(d.catalog.locationIds) : null;
    const catalogVenues = catalogIds
      ? d.venues.filter((v) => catalogIds.has(v.id))
      : d.venues;
    const labelCounts = new Map(
      OCCASION_LABELS.map((label) => [
        label,
        catalogVenues.filter((v) => occasionLabels(v.tags).includes(label))
          .length,
      ]),
    );
    const filtered = catalogVenues
      .filter(
        (v) =>
          (!query ||
            `${v.name} ${v.cuisine} ${v.neighborhood}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!neighborhood || v.neighborhood === neighborhood) &&
          (!cuisine || v.cuisine === cuisine) &&
          (!price || v.price === price.length) &&
          (!occasion ||
            occasionLabels(v.tags).some((label) => label === occasion)),
      )
      .sort(
        (a, b) =>
          Number(!!b.image) - Number(!!a.image) ||
          Number(average(b.id) || 0) - Number(average(a.id) || 0),
      );
    const reset = () => {
      setQuery("");
      setNeighborhood("");
      setCuisine("");
      setPrice("");
      setOccasion("");
    };
    content = (
      <>
        <div className="heading explore-heading">
          <div>
            <h1>New York, by taste.</h1>
            <p>Find a restaurant. Save a list. Take a friend.</p>
          </div>
          <span className="location-pill">
            <MapPin size={15} /> New York City
          </span>
        </div>
        <div className="search-row">
          <div className="searchbox">
            <Search size={20} />
            <input
              aria-label="Search restaurants"
              placeholder="Search restaurants, neighborhoods, cuisines…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Filter
            value={neighborhood}
            onChange={setNeighborhood}
            placeholder="Neighborhood"
            values={[
              ...new Set(catalogVenues.map((v) => v.neighborhood)),
            ].sort()}
          />
          <Filter
            value={cuisine}
            onChange={setCuisine}
            placeholder="Cuisine"
            values={[...new Set(catalogVenues.map((v) => v.cuisine))].sort()}
          />
          <Filter
            value={price}
            onChange={setPrice}
            placeholder="Any price"
            values={["$", "$$", "$$$", "$$$$"]}
          />
        </div>
        <div className="filter-chips">
          {[
            "All spots",
            ...OCCASION_LABELS.filter(
              (label) => (labelCounts.get(label) || 0) > 0,
            ),
          ].map((t) => (
            <button
              key={t}
              className={`chip ${occasion === t || (!occasion && t === "All spots") ? "active" : ""}`}
              aria-pressed={occasion === t || (!occasion && t === "All spots")}
              onClick={() => setOccasion(t === "All spots" ? "" : t)}
            >
              {t}
              {t !== "All spots" && (
                <span className="label-count">
                  {labelCounts.get(t as (typeof OCCASION_LABELS)[number])}
                </span>
              )}
            </button>
          ))}
          <div className="view-toggle">
            <button
              className={!mapView ? "active" : ""}
              onClick={() => setMapView(false)}
              aria-pressed={!mapView}
            >
              <Grid2X2 size={15} /> Grid
            </button>
            <button
              className={mapView ? "active" : ""}
              onClick={() => setMapView(true)}
              aria-pressed={mapView}
            >
              <MapIcon size={15} /> Map
            </button>
          </div>
        </div>
        {occasion && (
          <p className="label-filter-note">
            Based on published restaurant information. Coverage is still
            growing; places without a confirmed label aren’t included.
          </p>
        )}
        <div className="section-head">
          <h2>
            {query || neighborhood || cuisine || price || occasion
              ? "Find your kind of table"
              : "Restaurants in New York"}
          </h2>
          <span className="small muted">{filtered.length} spots</span>
        </div>
        {!filtered.length ? (
          <Empty
            title={
              d.catalog && !d.catalog.syncedAt
                ? "The restaurant catalog is being prepared"
                : "Nothing on this corner, yet"
            }
            body={
              d.catalog && !d.catalog.syncedAt
                ? "Please reload in a moment. No sign-in is needed to explore."
                : "Try another neighborhood or loosen your filters."
            }
            action={
              <button className="btn" onClick={reset}>
                Clear filters
              </button>
            }
          />
        ) : mapView ? (
          <DiningMap venues={filtered} card={card} />
        ) : (
          <>
            <div className="cards">
              {filtered.slice(0, visibleCount).map(card)}
            </div>
            {visibleCount < filtered.length && (
              <div className="load-more">
                <p className="small muted">
                  Showing {Math.min(visibleCount, filtered.length)} of{" "}
                  {filtered.length} spots
                </p>
                <button
                  className="btn"
                  onClick={() => setVisibleCount((n) => n + 24)}
                >
                  Show more restaurants
                </button>
              </div>
            )}
          </>
        )}
        <p className="note">
          {d.catalog?.syncedAt
            ? `${d.integration.environment === "production" ? "Blackbird NYC restaurants" : "Blackbird staging restaurants"} · Updated ${new Date(d.catalog.syncedAt).toLocaleDateString()} · Open to everyone.`
            : d.integration.discovery
              ? "The Blackbird restaurant catalog refreshes automatically."
              : "Demo catalog · Sample prices · Reviews require Blackbird check-ins."}
        </p>
        <div className="section-head">
          <h2>Lists from the community</h2>
          <Link className="text-link" href="/lists">
            All collections <ArrowRight size={16} />
          </Link>
        </div>
        <div className="cards list-cards">
          {d.lists
            .filter((l) => l.visibility === "public")
            .slice(0, 3)
            .map(listCard)}
        </div>
        <div className="banner">
          <div>
            <h3>Your places, all together.</h3>
            <p>
              Connect Blackbird to show the places you’ve visited on your
              profile.
            </p>
          </div>
          <button
            className="btn dark"
            onClick={() =>
              me ? go("/saved?tab=visits") : setModal({ type: "login" })
            }
          >
            Start your notebook <ArrowRight size={16} />
          </button>
        </div>
      </>
    );
  } else if (active === "restaurants") {
    const v = venue(path.split("/")[2]);
    const publicLists = d.lists.filter(
      (l) =>
        l.visibility === "public" &&
        listVenues(l.id).some((x) => x.id === v?.id),
    );
    content = !v ? (
      <Empty title="Spot not found" body="Try the restaurant directory." />
    ) : (
      <>
        <Link href="/explore" className="back">
          <ArrowLeft size={15} /> All spots
        </Link>
        <div className="heading">
          <div>
            <p className="eyebrow" style={{ margin: "0 0 10px" }}>
              {v.neighborhood} / NEW YORK
            </p>
            <h1>{v.name}</h1>
            <p>
              {v.cuisine} · {"$".repeat(v.price)} ·{" "}
              {v.source === "demo"
                ? "Sample catalog entry"
                : "On the Blackbird network"}
            </p>
          </div>
          <div className="actions">
            {bookmark(v)}
            <button
              className="btn primary"
              onClick={() => authThen({ type: "review", venue: v })}
            >
              <Plus size={16} /> Write a review
            </button>
          </div>
        </div>
        <div className="detail-grid">
          <div>
            <div className="detail-photo">
              <RestaurantImage venue={v} priority />
            </div>
            <p className="detail-description">{v.description}</p>
            {!!v.tag_sources?.length && (
              <details className="restaurant-labels">
                <summary>
                  {v.tag_sources.map((s) => s.label).join(" · ")}
                </summary>
                <p>
                  Tabletalk labels based on published information. Menus and
                  availability can change.
                </p>
                <ul>
                  {v.tag_sources.map((s) => (
                    <li key={s.label}>
                      <a href={safeUrl(s.url)} target="_blank" rel="noreferrer">
                        {s.label} source <ExternalLink size={13} />
                      </a>
                      <span className="muted">
                        {" "}
                        · Checked {new Date(s.checkedAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="section-head">
              <h2>Reviews</h2>
              {score(v.id)}
            </div>
            {d.reviews.filter((r) => r.venue_id === v.id).length ? (
              d.reviews
                .filter((r) => r.venue_id === v.id)
                .map((r) => reviewCard(r))
            ) : (
              <Empty
                title="Your take belongs here"
                body="Only diners with a Blackbird check-in at this location can review it."
                action={
                  <button
                    className="btn primary"
                    onClick={() => authThen({ type: "review", venue: v })}
                  >
                    Write a review
                  </button>
                }
              />
            )}
          </div>
          <aside className="stack">
            <div className="panel stack">
              <h3>Make a plan</h3>
              <p className="small">
                <MapPin
                  size={16}
                  style={{ display: "inline", marginRight: 8 }}
                />
                {v.address}
              </p>
              <a
                className="btn"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + " " + v.address)}`}
                target="_blank"
                rel="noreferrer"
              >
                Get directions <ExternalLink size={14} />
              </a>
              {v.website && (
                <a
                  className="btn"
                  href={safeUrl(v.website)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Restaurant website <ExternalLink size={14} />
                </a>
              )}
              <button
                className="btn dark"
                onClick={() => authThen({ type: "list", add: v.id })}
              >
                <Plus size={16} /> Add to a list
              </button>
              <p className="form-help">
                Check the restaurant website for current menus, hours and
                reservations.
              </p>
            </div>
            {publicLists.length > 0 && (
              <div className="panel">
                <h3>In good company</h3>
                <p className="small muted" style={{ margin: "9px 0 15px" }}>
                  Find this spot in these public lists.
                </p>
                <div className="stack">
                  {publicLists.map((l) => (
                    <Link
                      className="text-link"
                      key={l.id}
                      href={`/lists/${l.id}`}
                    >
                      {l.title}
                      <ChevronRight size={15} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </>
    );
  } else if (active === "lists" && !path.split("/")[2]) {
    content = (
      <>
        <div className="heading">
          <div>
            <h1>Lists to keep and share.</h1>
            <p>
              Lists from the community, with the most widely explored diners
              first.
            </p>
            <p className="small muted">
              Ranked by the creator’s distinct verified places visited.
            </p>
          </div>
          <button
            className="btn primary"
            onClick={() => authThen({ type: "list" })}
          >
            <Plus size={16} /> Create a list
          </button>
        </div>
        <div className="cards list-cards">
          {d.lists.filter((l) => l.visibility === "public").map(listCard)}
        </div>
      </>
    );
  } else if (active === "lists") {
    const l = d.lists.find((l) => l.id === path.split("/")[2]);
    content = !l ? (
      <Empty
        title="This list isn't available"
        body="It may be private or have been removed."
      />
    ) : (
      <>
        <Link href="/lists" className="back">
          <ArrowLeft size={15} /> All lists
        </Link>
        <div className="list-hero">
          <div className="eyebrow">
            {l.visibility === "public" ? "PUBLIC LIST" : "YOUR PRIVATE LIST"}
          </div>
          <h1 style={{ marginTop: 15 }}>{l.title}</h1>
          <p>{l.description}</p>
          <div className="actions">
            {person(l.user_id) && <Avatar person={person(l.user_id)!} />}
            <Link href={`/profile/${l.user_id}`}>
              {person(l.user_id)?.name}
            </Link>
            <span className="small">· {listVenues(l.id).length} spots</span>
            {person(l.user_id)?.demo ? (
              <span className="demo-tag">Demo</span>
            ) : null}
          </div>
        </div>
        <div className="section-head">
          <h2>The shortlist</h2>
          <div className="actions">
            {l.visibility === "public" && (
              <button
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success(
                      "Link copied. Anyone can view this public list.",
                    );
                  } catch {
                    toast.info(window.location.href, { duration: 10000 });
                  }
                }}
              >
                <Link2 size={15} /> Share
              </button>
            )}
            {me?.id === l.user_id ? (
              <button
                className="btn primary"
                onClick={() => setModal({ type: "list", list: l })}
              >
                Edit list
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  quick(
                    {
                      action: "saveList",
                      listId: l.id,
                      active: !d.saved.includes(l.id),
                    },
                    d.saved.includes(l.id) ? "List removed" : "List saved",
                  )
                }
              >
                <Bookmark size={15} />
                {d.saved.includes(l.id) ? "Saved" : "Save list"}
              </button>
            )}
          </div>
        </div>
        {listVenues(l.id).length ? (
          listVenues(l.id).map(row)
        ) : (
          <Empty
            title="The first spot is up to you"
            body="Add restaurants to start filling this list."
          />
        )}
        {l.visibility === "private" && (
          <p className="note">
            <Lock size={13} style={{ display: "inline" }} /> Only you can see
            this list.
          </p>
        )}
      </>
    );
  } else if (active === "feed") {
    const needsSuggestions = !!me && !d.following.length;
    const suggestions = (
      <section className="panel" style={{ alignSelf: "start" }}>
        <h2>
          {needsSuggestions ? "Find your people" : "Taste worth following"}
        </h2>
        <p className="small muted">
          Follow friends to bring their latest meals to your feed. Newest
          members first.
        </p>
        <input
          className="feed-people-search"
          aria-label="Find people"
          placeholder="Find a friend by name…"
          value={friendSearch}
          onChange={(e) => setFriendSearch(e.target.value)}
        />
        <div className="people" style={{ marginTop: 18 }}>
          {d.people
            .filter(
              (p) =>
                p.id !== me?.id &&
                p.name
                  .toLowerCase()
                  .includes(friendSearch.trim().toLowerCase()),
            )
            .sort(
              (a, b) =>
                (b.created_at || "").localeCompare(a.created_at || "") ||
                a.id.localeCompare(b.id),
            )
            .map((p) => (
              <div className="person" key={p.id}>
                <Link href={`/profile/${p.id}`}>
                  <Avatar person={p} />
                </Link>
                <div className="person-info">
                  <Link href={`/profile/${p.id}`}>
                    <strong>{p.name}</strong>
                  </Link>
                  <small>{p.visited_count || 0} verified places visited</small>
                </div>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    quick({
                      action: "follow",
                      targetId: p.id,
                      active: !d.following.includes(p.id),
                    })
                  }
                >
                  {d.following.includes(p.id) ? "Following" : "Follow"}
                </button>
              </div>
            ))}
        </div>
        {!d.people.some(
          (p) =>
            p.id !== me?.id &&
            p.name.toLowerCase().includes(friendSearch.trim().toLowerCase()),
        ) && (
          <p className="note">
            {friendSearch
              ? "No diners match that name."
              : "More diners will appear here when they join Tabletalk."}
          </p>
        )}
      </section>
    );
    content = (
      <>
        <div className="heading">
          <div>
            <h1>At your table.</h1>
            <p>Friends’ latest meals. Your next good find.</p>
          </div>
        </div>
        <div className="detail-grid">
          <div>
            <FriendsFeed
              key={me?.id || "guest"}
              suggestions={needsSuggestions ? suggestions : undefined}
              userId={me?.id}
              following={d.following}
              renderItem={activityCard}
              signIn={() => setModal({ type: "login" })}
            />
          </div>
          <aside style={{ alignSelf: "start" }}>
            {needsSuggestions ? (
              <div className="panel">
                <h3>Find your next spot.</h3>
                <p className="small muted">
                  Browse restaurants while your table comes together.
                </p>
                <Link className="btn" href="/explore">
                  Explore restaurants
                </Link>
              </div>
            ) : (
              suggestions
            )}
          </aside>
        </div>
      </>
    );
  } else if (active === "saved") {
    content = !me ? (
      <Empty
        title="A place for your next places"
        body="Sign in to keep restaurants and lists in your dining notebook."
        action={
          <button
            className="btn primary"
            onClick={() => setModal({ type: "login" })}
          >
            Start your notebook
          </button>
        }
      />
    ) : (
      <>
        <div className="heading">
          <div>
            <h1>My notebook.</h1>
            <p>
              Places you’ve saved, meals you’ve had, and lists worth keeping.
            </p>
          </div>
          <button
            className="btn primary"
            onClick={() => setModal({ type: "list" })}
          >
            <Plus size={16} /> New list
          </button>
        </div>
        <Tabs
          value={savedTab}
          onValueChange={(value) => {
            setSavedTab(value);
            window.history.replaceState(null, "", `/saved?tab=${value}`);
          }}
        >
          <TabsList variant="line" className="tabs-list">
            <TabsTrigger value="places">
              Saved places ({d.bookmarks.length})
            </TabsTrigger>
            <TabsTrigger value="visits">
              Been there ({d.visits.length})
            </TabsTrigger>
            <TabsTrigger value="lists">Lists</TabsTrigger>
          </TabsList>
        </Tabs>
        {savedTab === "places" ? (
          <>
            <p className="notebook-description">
              Your restaurant bookmarks, for a first visit or a return trip.
              Only you can see these.
            </p>
            {d.bookmarks.length ? (
              <div className="cards">
                {d.venues.filter((v) => d.bookmarks.includes(v.id)).map(card)}
              </div>
            ) : (
              <Empty
                title="Your next great meal starts here"
                body="Tap the bookmark on a restaurant to save it for later."
                action={
                  <Link className="btn primary" href="/explore">
                    Find a spot
                  </Link>
                }
              />
            )}
          </>
        ) : savedTab === "visits" ? (
          visitedPlaces()
        ) : (
          <>
            <p className="notebook-description">
              Collections you’ve created and public lists you’ve saved from
              other diners.
            </p>
            <section
              className="notebook-section"
              aria-labelledby="created-lists-heading"
            >
              <h2 id="created-lists-heading">Created by you</h2>
              <p className="muted">
                Choose who can see each list: keep it private or share it
                publicly.
              </p>
              {d.lists.some((l) => l.user_id === me.id) ? (
                <div className="cards list-cards">
                  {d.lists.filter((l) => l.user_id === me.id).map(listCard)}
                </div>
              ) : (
                <Empty
                  title="Make it a list"
                  body="Gather a few places for an occasion, a neighborhood, or a friend."
                  action={
                    <button
                      className="btn primary"
                      onClick={() => setModal({ type: "list" })}
                    >
                      Create your first list
                    </button>
                  }
                />
              )}
            </section>
            <section
              className="notebook-section"
              aria-labelledby="saved-lists-heading"
            >
              <h2 id="saved-lists-heading">Saved from others</h2>
              <p className="muted">
                Keep other diners’ collections handy. Their lists stay up to
                date here.
              </p>
              {d.lists.some(
                (l) => l.user_id !== me.id && d.saved.includes(l.id),
              ) ? (
                <div className="cards list-cards">
                  {d.lists
                    .filter(
                      (l) => l.user_id !== me.id && d.saved.includes(l.id),
                    )
                    .map(listCard)}
                </div>
              ) : (
                <Empty
                  title="Borrow a little good taste"
                  body="Save a public list to find it here whenever you need it."
                  action={
                    <Link className="btn primary" href="/lists">
                      Explore lists
                    </Link>
                  }
                />
              )}
            </section>
          </>
        )}
      </>
    );
  } else if (active === "me" || active === "profile") {
    const p = active === "me" ? me : person(path.split("/")[2]);
    const own = p?.id === me?.id;
    const visited = publicVisits
      .filter((v) => v.user_id === p?.id)
      .flatMap((visit) => {
        const place = venue(visit.venue_id);
        return place ? [{ ...place, visit_count: visit.visit_count }] : [];
      })
      .sort(
        (a, b) =>
          (b.visit_count ?? 0) - (a.visit_count ?? 0) ||
          a.name.localeCompare(b.name) ||
          a.neighborhood.localeCompare(b.neighborhood) ||
          a.id.localeCompare(b.id),
      );
    const ranked = d.reviews
      .filter((r) => r.user_id === p?.id)
      .sort((a, b) => b.rating - a.rating);
    const ls = d.lists.filter(
      (l) => l.user_id === p?.id && l.visibility === "public",
    );
    content = !p ? (
      <Empty
        title="Your table is waiting"
        body="Start a notebook to keep your lists, reviews and dining history together."
        action={
          <button
            className="btn primary"
            onClick={() => setModal({ type: "login" })}
          >
            Start your notebook
          </button>
        }
      />
    ) : (
      <>
        <div className="profile-hero">
          <Avatar person={p} large />
          <div className="profile-summary">
            <h1>{p.name}</h1>
            {p.bio && <p className="profile-bio">{p.bio}</p>}
            <div className="stats">
              <div>
                <strong>{ranked.length}</strong>Reviews
              </div>
              <div>
                <strong>{ls.length}</strong>Lists
              </div>
              <div>
                <strong>{visited.length}</strong>Been there
              </div>
            </div>
            <div className="actions profile-actions">
              {p.demo ? <span className="demo-tag">Demo diner</span> : null}
              {own ? (
                <button
                  className="btn"
                  onClick={() => setModal({ type: "profile" })}
                >
                  Edit profile
                </button>
              ) : (
                <button
                  className="btn primary"
                  onClick={() =>
                    quick({
                      action: "follow",
                      targetId: p.id,
                      active: !d.following.includes(p.id),
                    })
                  }
                >
                  {d.following.includes(p.id) ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </div>
        {own &&
          (d.passport?.status === "reconnect" ||
            d.passport?.status === "error") &&
          passportBanner()}
        {own && (
          <Link
            className="profile-notebook-link"
            aria-label="View my visit details in My notebook"
            href="/saved?tab=visits"
          >
            Visit details in My notebook <ArrowRight size={15} />
          </Link>
        )}
        <Tabs value={profileTab} onValueChange={setProfileTab}>
          <TabsList variant="line" className="tabs-list">
            <TabsTrigger value="visits">
              Been there ({visited.length})
            </TabsTrigger>
            <TabsTrigger value="rankings">
              Reviews ({ranked.length})
            </TabsTrigger>
            <TabsTrigger value="lists">Public lists</TabsTrigger>
          </TabsList>
        </Tabs>
        {profileTab === "visits" ? (
          visited.length ? (
            <>
              <p className="notebook-description">
                Most visited first, based on synced Blackbird check-ins.
              </p>
              <div className="public-visits">
                {visited.map((v) => (
                  <article className="visit-row" key={v.id}>
                    <Link href={`/restaurants/${v.id}`} className="visit-photo">
                      <RestaurantImage venue={v} compact />
                    </Link>
                    <div className="row-info">
                      <Link href={`/restaurants/${v.id}`}>
                        <h2>{v.name}</h2>
                      </Link>
                      <p className="muted">
                        {v.neighborhood} · {v.cuisine}
                      </p>
                    </div>
                    <span className="verified">
                      <CheckCircle2 size={16} />{" "}
                      {verifiedVisitLabel(v.visit_count)}
                    </span>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <Empty
              title="No verified visits yet"
              body={
                own
                  ? "Your Blackbird places appear here after your visits sync."
                  : "Places will appear here when this diner syncs Blackbird visits."
              }
            />
          )
        ) : profileTab === "rankings" ? (
          ranked.length ? (
            <div className="stack">
              {ranked.map((r) => reviewCard(r, true))}
            </div>
          ) : (
            <Empty
              title="Every good notebook has a first page"
              body={
                own
                  ? "Review a restaurant you’ve visited to share your experience."
                  : "This diner hasn’t published a review yet."
              }
              action={
                <Link href="/explore" className="btn primary">
                  Explore NYC
                </Link>
              }
            />
          )
        ) : ls.length ? (
          <div className="cards list-cards">{ls.map(listCard)}</div>
        ) : (
          <Empty
            title="No public lists yet"
            body={
              own
                ? "Create a public list in My notebook to share it here."
                : "Public lists will appear here when this diner shares one."
            }
          />
        )}
        {own && (
          <button
            className="btn light"
            style={{ marginTop: 30 }}
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/";
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        )}
      </>
    );
  } else {
    content = (
      <div className="about">
        <Link href="/" className="back">
          <ArrowLeft size={15} /> Back to the table
        </Link>
        <h1>About Tabletalk.</h1>
        <h2>Your city. Your people. Your taste.</h2>
        <p>
          Tabletalk is an independent dining notebook for New York. Explore
          spots, write honest reviews, share a list without a login wall, and
          follow people whose taste you trust.
        </p>
        <h2>A little help choosing dinner.</h2>
        <p>
          Browse New York restaurants and public lists without an account. Sign
          in with Blackbird to keep your own notebook, share favorite places and
          follow diners whose recommendations you love.
        </p>
        <h2>Reviews from people who’ve been.</h2>
        <p>
          Your Blackbird visits sync when you sign in. A verified visit to that
          restaurant is required to write or edit a review, so every review
          starts with a meal someone actually had.
        </p>
        <h2>Your notebook, your choice.</h2>
        <p>
          Your profile, reviews and the restaurants you’ve visited are public.
          Visit dates and saved places stay private. Make a list public to share
          it with anyone, or keep it private for your own plans.
        </p>
        {d.integration.discovery && (
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch("/api/flynet/discovery", {
                  method: "POST",
                });
                const b = (await r.json()) as {
                  error?: string;
                  count: number;
                  complete: boolean;
                };
                if (!r.ok) throw new Error(b.error);
                await load();
                toast.success(`${b.count} NYC spots available to everyone.`);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Refresh restaurant directory
          </button>
        )}
        <h2>Photo credits</h2>
        <p>
          Venue photos are credited to{" "}
          <a href="https://www.rubirosanyc.com/">Rubirosa</a>,{" "}
          <a href="https://www.thaidiner.com/">Thai Diner</a> and{" "}
          <a href="https://www.binxnyc.com/">BINX</a>. Additional photos come
          from Lilia, Estela, Via Carota, Balthazar (Daniel Krieger), COTE, Los
          Tacos No. 1, Golden Diner (Marcus Lloyd), and Win Son (Gabi Porter).
          Restaurant website links appear on each venue page. Copyright stays
          with the respective photographers and restaurants.
        </p>
        <h2>Made for the next meal.</h2>
        <p>
          Built for Runtime's Blackbird track. Powered by Flynet. Tabletalk is
          not affiliated with or endorsed by Blackbird or Beli.
        </p>
      </div>
    );
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" href="/">
          tabletalk
        </Link>
        <nav className="nav" aria-label="Main navigation">
          {[
            ["/", "Home", "feed"],
            ["/explore", "Explore", "explore"],
            ["/lists", "Lists", "lists"],
            ["/saved", "My notebook", "saved"],
          ].map(([url, label, section]) => (
            <Link
              href={url as string}
              key={url as string}
              className={active === section ? "active" : ""}
              aria-current={active === section ? "page" : undefined}
            >
              {label as string}
            </Link>
          ))}
        </nav>
        <div className="actions">
          {me ? (
            <Link href="/me" aria-label="Your profile">
              <Avatar person={me} />
            </Link>
          ) : (
            <button
              className="btn dark"
              onClick={() => setModal({ type: "login" })}
            >
              Join the table <ArrowRight size={14} />
            </button>
          )}
        </div>
      </header>
      <main id="main" className="shell">
        {error && (
          <div role="alert" className="form-error" style={{ marginBottom: 20 }}>
            {error} <button onClick={load}>Retry</button>
          </div>
        )}
        {content}
        <footer className="footer">
          <Link className="brand" href="/">
            tabletalk
          </Link>
          <span>Made for people who make plans around food.</span>
          <div className="actions">
            <Link href="/about">About & data</Link>
            <a href="https://flynet.org" target="_blank" rel="noreferrer">
              Powered by Flynet ↗
            </a>
          </div>
        </footer>
      </main>
      <Dialog
        open={!!modal && modal.type !== "confirm"}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
      >
        <DialogContent className="modal" style={{ maxWidth: 560 }}>
          <ModalBody
            key={JSON.stringify(modal)}
            modal={modal}
            data={d}
            close={() => setModal(null)}
            reload={load}
            action={action}
            navigate={go}
          />
        </DialogContent>
      </Dialog>
      {modal?.type === "confirm" && (
        <ConfirmDialog
          open
          title={modal.title}
          onClose={() => setModal(null)}
          onConfirm={modal.run}
        />
      )}
      <Toaster position="bottom-right" />
    </>
  );
}
function ModalBody({
  modal,
  data,
  close,
  reload,
  action,
  navigate,
}: {
  modal: Modal;
  data: State;
  close: () => void;
  reload: () => Promise<void>;
  action: (b: Record<string, unknown>) => Promise<{ id?: string }>;
  navigate: (s: string) => void;
}) {
  const existing =
    modal?.type === "review"
      ? data.reviews.find(
          (r) => r.user_id === data.me?.id && r.venue_id === modal.venue.id,
        )
      : undefined;
  const original = modal?.type === "list" ? modal.list : undefined;
  const [name, setName] = useState(data.me?.name || ""),
    [bio, setBio] = useState(data.me?.bio || ""),
    [rating, setRating] = useState(existing?.rating || 8),
    [body, setBody] = useState(existing?.body || ""),
    [dish, setDish] = useState(existing?.dish || ""),
    [date, setDate] = useState(
      existing?.visited_at || new Date().toISOString().slice(0, 10),
    ),
    [title, setTitle] = useState(original?.title || ""),
    [description, setDescription] = useState(original?.description || ""),
    [visibility, setVisibility] = useState(original?.visibility || "public"),
    [ids, setIds] = useState<string[]>(
      original
        ? data.items
            .filter((i) => i.list_id === original.id)
            .map((i) => i.venue_id)
        : modal?.type === "list" && modal.add
          ? [modal.add]
          : [],
    ),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!modal) return null;
  const head = (t: string, desc: string) => (
    <DialogHeader>
      <DialogTitle>{t}</DialogTitle>
      <DialogDescription>{desc}</DialogDescription>
    </DialogHeader>
  );
  if (modal.type === "login")
    return (
      <>
        {head(
          "Your dining notebook.",
          "A notebook for the places you love and the ones you’ll love next.",
        )}
        <div className="form-stack">
          <a className="btn dark" href="/api/auth/blackbird/start">
            <Utensils size={17} /> Connect with Blackbird{" "}
            <ArrowRight size={16} />
          </a>
          {!data.integration.configured && (
            <p className="form-help">
              Blackbird sign-in is awaiting developer access. You can browse
              restaurants and public lists without signing in.
            </p>
          )}
          <p className="form-help">
            Your verified visited places appear on your public profile. Check-in
            dates stay private. Browsing is always open.
          </p>
        </div>
      </>
    );
  if (
    modal.type === "review" &&
    !data.visits.some((v) => v.venue_id === modal.venue.id)
  )
    return (
      <>
        {head("A visit comes first", modal.venue.name)}
        <div className="form-stack">
          <p>
            Reviews are reserved for diners with a Blackbird check-in at this
            exact location.
          </p>
          <p className="form-help">
            {data.integration.configured
              ? "Your Blackbird visits sync automatically. Reviews unlock for locations you’ve checked in to. Check Been there in My notebook for the sync status."
              : "Blackbird connection is awaiting partner access. You can still browse restaurants and public lists; account features will unlock after Blackbird sign-in is available."}
          </p>
          {data.integration.configured &&
            data.passport?.status === "reconnect" && (
              <a className="btn primary" href="/api/auth/blackbird/start">
                Reconnect Blackbird
              </a>
            )}
          <a className="btn" href="/saved?tab=visits">
            View my visits
          </a>
        </div>
      </>
    );
  if (modal.type === "review")
    return (
      <>
        {head(
          existing ? "Another thought?" : "How was your table?",
          modal.venue.name,
        )}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await action({
                action: "review",
                venueId: modal.venue.id,
                rating,
                body,
                dish,
                visitedAt: date,
              });
              toast.success(existing ? "Review updated" : "Review published");
            });
          }}
        >
          <label>
            Your rating
            <div className="rating-range">
              <input
                type="number"
                min="1"
                max="10"
                step="0.1"
                required
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              />
              <span className="muted">out of 10 · your personal taste</span>
            </div>
          </label>
          <label>
            The honest take
            <textarea
              required
              minLength={3}
              maxLength={2000}
              placeholder="The dish you'd go back for, the vibe, the little details…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label>
            What should we order?
            <input
              maxLength={100}
              placeholder="Your favorite dish (optional)"
              value={dish}
              onChange={(e) => setDish(e.target.value)}
            />
          </label>
          <label>
            When did you visit?
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <p className="form-help">
            Your review is public. Your imported Blackbird history verifies that
            you visited this location.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : existing ? "Save review" : "Publish review"}
          </button>
        </form>
      </>
    );
  if (modal.type === "profile")
    return (
      <>
        {head("Make yourself at home.", "Your name and bio are public.")}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await action({ action: "profile", name, bio });
              toast.success("Profile updated");
            });
          }}
        >
          <label>
            Display name
            <input
              value={name}
              minLength={2}
              maxLength={40}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            A little about your taste
            <textarea
              value={bio}
              maxLength={200}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            Save profile
          </button>
        </form>
      </>
    );
  if (modal.type === "confirm") return null;
  const matchingVenues = data.venues.filter((v) =>
    `${v.name} ${v.neighborhood} ${v.address}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      {head(
        original ? "Edit your list" : "Create a list",
        "A few good places, in your own order.",
      )}
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await action({
              action: "list",
              listId: original?.id,
              title,
              description,
              visibility,
              venueIds: ids,
            });
            toast.success(original ? "List updated" : "List created");
            navigate(`/lists/${r.id}`);
          });
        }}
      >
        {modal.add &&
          !original &&
          data.lists.some((l) => l.user_id === data.me?.id) && (
            <div>
              <label>Add to an existing list</label>
              <div className="picker" style={{ marginTop: 8 }}>
                {data.lists
                  .filter((l) => l.user_id === data.me?.id)
                  .map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const venueIds = [
                            ...new Set([
                              ...data.items
                                .filter((i) => i.list_id === l.id)
                                .map((i) => i.venue_id),
                              modal.add!,
                            ]),
                          ];
                          await action({
                            action: "list",
                            listId: l.id,
                            title: l.title,
                            description: l.description,
                            visibility: l.visibility,
                            venueIds,
                          });
                          toast.success("Added to list");
                          navigate(`/lists/${l.id}`);
                        })
                      }
                    >
                      {l.title}
                      <Plus size={15} />
                    </button>
                  ))}
              </div>
              <p className="form-help" style={{ marginTop: 12 }}>
                Or create a new list below.
              </p>
            </div>
          )}
        <label>
          List name
          <input
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. The downtown dinner rotation"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          A note for the table
          <textarea
            maxLength={500}
            placeholder="What ties these places together?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div>
          <label style={{ marginBottom: 6 }}>Who can see it?</label>
          <Filter
            value={visibility}
            onChange={setVisibility}
            placeholder="Visibility"
            values={["public", "private"]}
          />
          <p className="form-help" style={{ marginTop: 5 }}>
            {visibility === "public"
              ? "Anyone with the link. Share freely."
              : "Only you. Shared links will not reveal this list."}
          </p>
        </div>
        <section
          className="list-editor-section"
          aria-labelledby="list-find-heading"
        >
          <h3 id="list-find-heading">Find restaurants</h3>
          <input
            aria-label="Find a restaurant for your list"
            placeholder="Search by name, neighborhood or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div
            className="picker list-restaurant-picker"
            aria-label="Restaurant search results"
          >
            {matchingVenues.map((v) => {
              const added = ids.includes(v.id);
              return (
                <button
                  type="button"
                  key={v.id}
                  disabled={added || busy}
                  aria-label={`${added ? "Added" : "Add"} ${v.name}, ${v.address || v.neighborhood}`}
                  onClick={() =>
                    setIds((a) => (a.includes(v.id) ? a : [...a, v.id]))
                  }
                >
                  <span className="picker-photo">
                    <RestaurantImage venue={v} compact />
                  </span>
                  <span className="picker-place-details">
                    <strong>{v.name}</strong>
                    <span>{v.neighborhood}</span>
                    {v.address && <span>{v.address}</span>}
                  </span>
                  <span
                    className={`picker-place-action ${added ? "is-added" : ""}`}
                  >
                    {added ? <Check size={16} /> : <Plus size={16} />}
                    <span>{added ? "Added" : "Add"}</span>
                  </span>
                </button>
              );
            })}
            {!matchingVenues.length && (
              <p className="list-editor-empty">
                No matching restaurants. Try another name or address.
              </p>
            )}
          </div>
        </section>
        <section
          className="list-editor-section list-editor-selection"
          aria-labelledby="list-selection-heading"
        >
          <div className="list-editor-section-heading">
            <h3 id="list-selection-heading">
              Your list <span>({ids.length})</span>
            </h3>
            <span className="form-help" role="status" aria-live="polite">
              {ids.length} {ids.length === 1 ? "spot" : "spots"} added
            </span>
          </div>
          <p className="form-help">
            {ids.length
              ? "Use the arrows to set the order."
              : "Add restaurants above to start your list."}
          </p>
          <ol className="selected-places">
            {ids.map((id, i) => {
              const venue = data.venues.find((v) => v.id === id);
              const label = venue
                ? `${venue.name}, ${venue.address || venue.neighborhood}`
                : "Unavailable restaurant";
              return (
                <li className="selected-place" key={id}>
                  <span className="selected-place-rank" aria-hidden="true">
                    {i + 1}
                  </span>
                  {venue && (
                    <span className="picker-photo">
                      <RestaurantImage venue={venue} compact />
                    </span>
                  )}
                  <span className="picker-place-details">
                    <strong>{venue?.name || "Unavailable restaurant"}</strong>
                    {venue && <span>{venue.neighborhood}</span>}
                    {venue?.address && <span>{venue.address}</span>}
                  </span>
                  <div className="selected-place-actions">
                    <button
                      type="button"
                      aria-label={`Move ${label} up`}
                      disabled={busy || i === 0}
                      onClick={() =>
                        setIds((a) => {
                          const b = [...a];
                          [b[i - 1], b[i]] = [b[i], b[i - 1]];
                          return b;
                        })
                      }
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${label} down`}
                      disabled={busy || i === ids.length - 1}
                      onClick={() =>
                        setIds((a) => {
                          const b = [...a];
                          [b[i + 1], b[i]] = [b[i], b[i + 1]];
                          return b;
                        })
                      }
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${label}`}
                      disabled={busy}
                      onClick={() => setIds((a) => a.filter((x) => x !== id))}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving…" : original ? "Save list" : "Create list"}
        </button>
        {original && (
          <button
            type="button"
            className="btn light"
            disabled={busy}
            onClick={() => setDeleteConfirm(true)}
          >
            Delete this list
          </button>
        )}
      </form>
      {original && (
        <ConfirmDialog
          open={deleteConfirm}
          title="Delete this list?"
          onClose={() => setDeleteConfirm(false)}
          onConfirm={async () => {
            await action({ action: "deleteList", listId: original.id });
            close();
            navigate("/saved");
            toast.success("List deleted");
          }}
        />
      )}
    </>
  );
}
