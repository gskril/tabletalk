"use client";
import { useEffect, useRef, useState } from "react";
import RestaurantImage from "./restaurant-image";
import type { Venue } from "@/lib/types";
import type { Map as LeafletMap, Marker } from "leaflet";
export default function DiningMap({
  venues,
  card,
}: {
  venues: Venue[];
  card: (v: Venue) => React.ReactNode;
}) {
  const [selected, setSelected] = useState(venues[0]?.id),
    [mapError, setMapError] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const key = venues.map((v) => v.id).join(",");
  const current = venues.find((v) => v.id === selected) || venues[0];
  useEffect(() => {
    let cancelled = false;
    const points = venues.filter((v) => v.lat !== null && v.lng !== null);
    import("leaflet")
      .then((L) => {
        if (cancelled || !element.current) return;
        const m = L.map(element.current, { scrollWheelZoom: false }).setView(
          [40.725, -73.985],
          13,
        );
        map.current = m;
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        ).addTo(m);
        tiles.on("tileerror", () => setMapError(true));
        for (const p of points) {
          // Use DOM nodes so restaurant names and image URLs are never HTML.
          const badge = document.createElement("span");
          badge.className = "restaurant-marker-badge";
          badge.setAttribute("aria-hidden", "true");
          const initials =
            p.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((word) => word[0])
              .join("")
              .toUpperCase() || "•";
          badge.textContent = initials;
          const src = [p.image_thumb, p.image].find((url) =>
            /^https?:\/\//.test(url || ""),
          );
          if (src) {
            const logo = document.createElement("img");
            logo.src = src;
            logo.alt = "";
            logo.width = 40;
            logo.height = 40;
            logo.loading = "lazy";
            logo.decoding = "async";
            logo.onerror = () => {
              badge.textContent = initials;
            };
            badge.replaceChildren(logo);
          }
          const marker = L.marker([p.lat!, p.lng!], {
            icon: L.divIcon({
              className: "restaurant-marker",
              html: badge,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            }),
            title: p.name,
            keyboard: true,
          }).addTo(m);
          marker.on("click", () => setSelected(p.id));
          const icon = marker.getElement();
          icon?.setAttribute("aria-label", `Show ${p.name}`);
          icon?.setAttribute("role", "button");
          icon?.setAttribute("aria-pressed", String(p.id === current?.id));
          icon?.addEventListener("keydown", (event) => {
            if (event.key === " ") {
              event.preventDefault();
              setSelected(p.id);
            }
          });
          marker.setZIndexOffset(p.id === current?.id ? 1000 : 0);
          markers.current.set(p.id, marker);
        }
        if (points.length)
          m.fitBounds(
            points.map((p) => [p.lat!, p.lng!] as [number, number]),
            { padding: [55, 55], maxZoom: 16 },
          );
      })
      .catch(() => setMapError(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
    // Recreate only when the result set changes, not when its selected card changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      const active = id === current?.id;
      marker.getElement()?.setAttribute("aria-pressed", String(active));
      marker.setZIndexOffset(active ? 1000 : 0);
    }
  }, [current?.id]);
  return (
    <div className="map-layout">
      <div>
        <div
          className="map leaflet-map"
          ref={element}
          role="region"
          aria-label="NYC restaurant map"
        />
        {mapError && (
          <p className="note">
            Some map tiles are unavailable. You can still select restaurants
            below or use their directions link.
          </p>
        )}
        <div className="map-place-picker" aria-label="Restaurants on the map">
          {venues.map((v) => (
            <button
              key={v.id}
              className={`chip ${v.id === current?.id ? "active" : ""}`}
              aria-pressed={v.id === current?.id}
              onClick={() => {
                setSelected(v.id);
                if (v.lat !== null && v.lng !== null)
                  map.current?.setView([v.lat, v.lng], 16);
              }}
            >
              <span className="map-picker-photo">
                <RestaurantImage venue={v} compact />
              </span>
              {v.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        {current && card(current)}
        <p className="note">
          Zoom in or select a restaurant to see its details.
        </p>
      </div>
    </div>
  );
}
