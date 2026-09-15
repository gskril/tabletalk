"use client";
import { useEffect, useRef, useState } from "react";
import RestaurantImage from "./restaurant-image";
import type { Venue } from "@/lib/types";
import type { Map as LeafletMap } from "leaflet";
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
        for (const [i, p] of points.entries()) {
          const marker = L.marker([p.lat!, p.lng!], {
            icon: L.divIcon({
              className: "restaurant-marker",
              html: `<span>${i + 1}</span>`,
              iconSize: [32, 36],
              iconAnchor: [16, 36],
            }),
            title: p.name,
            keyboard: true,
          }).addTo(m);
          marker.on("click", () => setSelected(p.id));
          const icon = marker.getElement();
          icon?.setAttribute("aria-label", `Show ${p.name}`);
          icon?.setAttribute("role", "button");
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
    };
    // Recreate only when the result set changes, not when its selected card changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
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
          {venues.map((v, i) => (
            <button
              key={v.id}
              className={`chip ${v.id === current?.id ? "active" : ""}`}
              onClick={() => {
                setSelected(v.id);
                if (v.lat !== null && v.lng !== null)
                  map.current?.setView([v.lat, v.lng], 16);
              }}
            >
              <span className="map-picker-photo"><RestaurantImage venue={v} compact /></span>
              {i + 1}. {v.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        {current && card(current)}
        <p className="note">
          Zoom in or select a spot below the map. Sample coordinates are
          approximate.
        </p>
      </div>
    </div>
  );
}
