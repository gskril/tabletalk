"use client";
import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FriendsFeed({
  userId,
  following,
  renderItem,
  signIn,
  suggestions,
}: {
  suggestions?: React.ReactNode;
  userId?: string;
  following: string[];
  renderItem: (item: FeedItem) => React.ReactNode;
  signIn: () => void;
}) {
  const [scope, setScope] = useState(userId ? "following" : "everyone");
  const [kind, setKind] = useState("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const followingKey = [...following].sort().join(",");
  async function fetchPage(next?: string) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        scope,
        kind: scope === "everyone" ? "review" : kind,
      });
      if (next) query.set("cursor", next);
      const response = await fetch(`/api/feed?${query}`, {
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        items: FeedItem[];
        nextCursor: string | null;
        error?: string;
      };
      if (!response.ok) throw Error(data.error || "Couldn’t load the feed.");
      if (controller.signal.aborted) return;
      setItems((previous) =>
        next
          ? [
              ...previous,
              ...data.items.filter(
                (item: FeedItem) => !previous.some((p) => p.id === item.id),
              ),
            ]
          : data.items,
      );
      setCursor(data.nextCursor);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Couldn’t load the feed.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    setItems([]);
    setCursor(null);
    if (scope === "following" && !userId) {
      setLoading(false);
      return;
    }
    void fetchPage();
    return () => requestRef.current?.abort();
    // Reset pagination when the scope, filters, account or followed people change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, kind, userId, followingKey, refresh]);
  return (
    <div className="friends-feed">
      <Tabs
        value={scope}
        onValueChange={(value) => {
          setScope(value);
          setKind("all");
        }}
      >
        <TabsList variant="line" className="tabs-list">
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="everyone">Community</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="feed-controls">
        {scope === "following" ? (
          <div className="feed-filters" aria-label="Activity type">
            {[
              ["all", "All activity"],
              ["checkin", "Check-ins"],
              ["review", "Reviews"],
            ].map(([value, label]) => (
              <button
                type="button"
                className={`chip ${kind === value ? "active" : ""}`}
                aria-pressed={kind === value}
                key={value}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="small muted">
            Public reviews from the community. Follow diners to see their
            check-ins.
          </p>
        )}
        <button
          className="text-link"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          Refresh feed
        </button>
      </div>
      {scope === "following" && !userId ? (
        <div className="feed-empty">
          <h2>Your friends’ next good find.</h2>
          <p>
            Sign in with Blackbird and follow diners to see where they’ve been.
          </p>
          <button className="btn primary" onClick={signIn}>
            Connect with Blackbird
          </button>
        </div>
      ) : (
        <>
          {items.map(renderItem)}
          {loading && (
            <p className="note" role="status">
              Loading activity…
            </p>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}{" "}
              <button
                className="text-link"
                onClick={() =>
                  void fetchPage(items.length && cursor ? cursor : undefined)
                }
              >
                Try again
              </button>
            </div>
          )}
          {scope === "following" && !following.length && suggestions}
          {!loading &&
            !error &&
            !items.length &&
            !(scope === "following" && suggestions) && (
              <div className="feed-empty">
                <h2>
                  {scope === "following" && !following.length
                    ? "Good taste is better shared."
                    : "Nothing here yet."}
                </h2>
                <p>
                  {scope === "following" && !following.length
                    ? "Find a friend below and follow them. Their latest check-ins and reviews will appear here."
                    : scope === "following"
                      ? "New activity from the diners you follow will appear here as they sync their Blackbird visits or post a review."
                      : "Reviews from the community will appear here."}
                </p>
              </div>
            )}
          {!loading && cursor && (
            <button
              className="btn feed-more"
              onClick={() => void fetchPage(cursor)}
            >
              Load older activity
            </button>
          )}
          {scope === "following" && items.length > 0 && (
            <p className="note">
              Check-ins show each diner’s latest synced visit to a restaurant.
              Visit dates may be older than the last sync.
            </p>
          )}
        </>
      )}
    </div>
  );
}
