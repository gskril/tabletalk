"use client";
import { useState } from "react";
import { Utensils } from "lucide-react";
import type { Venue } from "@/lib/types";

const remoteImage = (value?: string) => /^https?:\/\//.test(value || "") ? value! : "";
/** Use Blackbird's supplied preview for compact views; never load its full3x asset. */
export default function RestaurantImage({venue, compact = false, priority = false}: {
  venue: Venue; compact?: boolean; priority?: boolean;
}) {
  const preview = remoteImage(venue.image_thumb);
  const full = remoteImage(venue.image) || preview;
  const src = compact ? preview || full : full;
  const key = `${src}|${preview}`;
  const [failed, setFailed] = useState("");
  return <span className="restaurant-image" aria-hidden="true">
    {src && failed !== key ? <picture>
      {!compact && preview && preview !== full && <source media="(max-width: 600px)" srcSet={preview} />}
      <img src={src} alt="" width={640} height={480}
        loading={priority ? "eager" : "lazy"} decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setFailed(key)} />
    </picture> : <span className="restaurant-image-empty"><Utensils size={24} /><span>Photo unavailable</span></span>}
  </span>;
}
