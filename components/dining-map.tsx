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
  const selectedId = useRef<string | undefined>(undefined);
  const key = venues.map((v) => v.id).join(",");
  const current = venues.find((v) => v.id === selected) || venues[0];
  useEffect(() => {
    let cancelled = false;
    setMapError(false);
    const points = venues.filter((v) => v.lat !== null && v.lng !== null);
    import("leaflet")
      .then((L) => {
        if (cancelled || !element.current) return;
        const m = L.map(element.current, {
          scrollWheelZoom: false,
          zoomControl: false,
        }).setView([40.725, -73.985], 13);
        map.current = m;
        L.control.zoom({ position: "topright" }).addTo(m);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        ).addTo(m);
        tiles.on("tileerror", () => setMapError(true));
        if (points.length)
          m.fitBounds(
            points.map((p) => [p.lat!, p.lng!] as [number, number]),
            { padding: [55, 55], maxZoom: 16 },
          );
        const layer = L.layerGroup().addTo(m);
        // Group by distance in map pixels, so logos separate as you zoom in.
        // Keep each group's anchor fixed to guarantee space between markers.
        const renderMarkers = () => {
          layer.clearLayers();
          markers.current.clear();
          const groups: {
            anchor: ReturnType<typeof L.point>;
            venues: Venue[];
          }[] = [];
          for (const venue of points) {
            const point = m.project([venue.lat!, venue.lng!], m.getZoom());
            const group = groups.find((g) => g.anchor.distanceTo(point) < 64);
            if (group) group.venues.push(venue);
            else groups.push({ anchor: point, venues: [venue] });
          }
          for (const group of groups) {
            const p = group.venues[0];
            if (!m.getBounds().pad(0.2).contains([p.lat!, p.lng!])) continue;
            const clustered = group.venues.length > 1;
            const badge = document.createElement("span");
            badge.className = clustered
              ? "restaurant-cluster-badge"
              : "restaurant-marker-badge";
            badge.setAttribute("aria-hidden", "true");
            const initials =
              p.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0])
                .join("")
                .toUpperCase() || "•";
            badge.textContent = clustered
              ? String(group.venues.length)
              : initials;
            if (!clustered) {
              const src = [p.image_thumb, p.image].find((url) =>
                /^https?:\/\//.test(url || ""),
              );
              if (src) {
                const logo = document.createElement("img");
                logo.src = src;
                logo.alt = "";
                logo.width = 36;
                logo.height = 36;
                // Only visible markers are mounted; load them immediately.
                logo.decoding = "async";
                logo.onerror = () => {
                  badge.textContent = initials;
                };
                badge.replaceChildren(logo);
              }
            }
            const label = clustered
              ? `Zoom in to ${group.venues.length} restaurants`
              : `Show ${p.name}`;
            const marker = L.marker([p.lat!, p.lng!], {
              icon: L.divIcon({
                className: clustered
                  ? "restaurant-marker restaurant-cluster"
                  : "restaurant-marker",
                html: badge,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
              }),
              title: clustered
                ? `${group.venues.length} restaurants nearby`
                : p.name,
              keyboard: true,
            }).addTo(layer);
            const selectVenue = (venue: Venue) => {
              setSelected(venue.id);
              m.closePopup();
            };
            const activate = () => {
              if (!clustered) {
                selectVenue(p);
                return;
              }
              if (m.getZoom() < m.getMaxZoom()) {
                const bounds = L.latLngBounds(
                  group.venues.map((v) => [v.lat!, v.lng!]),
                );
                const zoom = Math.min(
                  m.getMaxZoom(),
                  Math.max(
                    m.getZoom() + 1,
                    Math.min(
                      m.getZoom() + 2,
                      m.getBoundsZoom(bounds, false, L.point(80, 80)),
                    ),
                  ),
                );
                m.setView(bounds.getCenter(), zoom);
              } else {
                // Separate restaurants can share an address. Keep all reachable
                // even when no further zoom can separate their coordinates.
                const choices = document.createElement("div");
                choices.className = "map-cluster-choices";
                for (const venue of group.venues) {
                  const button = document.createElement("button");
                  button.type = "button";
                  button.textContent = venue.name;
                  button.addEventListener("click", () => selectVenue(venue));
                  choices.appendChild(button);
                }
                L.popup()
                  .setLatLng(marker.getLatLng())
                  .setContent(choices)
                  .openOn(m);
                choices.querySelector("button")?.focus();
              }
            };
            marker.on("click", activate);
            const icon = marker.getElement();
            icon?.setAttribute("aria-label", label);
            icon?.setAttribute("role", "button");
            icon?.addEventListener("keydown", (event) => {
              if (event.key === " ") {
                event.preventDefault();
                activate();
              }
            });
            if (!clustered) {
              const active = p.id === selectedId.current;
              icon?.setAttribute("aria-pressed", String(active));
              marker.setZIndexOffset(active ? 1000 : 0);
              markers.current.set(p.id, marker);
            }
          }
        };
        m.on("moveend", renderMarkers);
        renderMarkers();
        const resize = new ResizeObserver(() => m.invalidateSize());
        resize.observe(element.current);
        m.on("unload", () => resize.disconnect());
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
    selectedId.current = current?.id;
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
          Tap a group to zoom in, then choose a restaurant.
        </p>
      </div>
    </div>
  );
}
