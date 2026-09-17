export type Person = {
  id: string;
  name: string;
  bio: string;
  color: string;
  avatar?: string;
  demo: number;
  visited_count?: number;
  created_at?: string;
};
export type Venue = {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  address: string;
  price: number;
  lat: number | null;
  lng: number | null;
  image: string;
  image_thumb?: string;
  website: string;
  description: string;
  tags: string;
  tag_sources?: { label: string; url: string; checkedAt: string }[];
  source: string;
  updated_at: string;
};
export type Review = {
  id: string;
  user_id: string;
  venue_id: string;
  rating: number;
  body: string;
  dish: string;
  visited_at: string;
  created_at: string;
  name: string;
  color: string;
  avatar?: string;
  demo: number;
  verified: number;
  likes: number;
};
export type DiningList = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  visibility: string;
  color: string;
  created_at: string;
  saves: number;
};
export type Passport = {
  status: "syncing" | "ready" | "error" | "reconnect";
  syncedAt: number | null;
  complete: boolean;
};
export type State = {
  passport?: Passport | null;
  catalog?: { locationIds: string[]; syncedAt: number | null } | null;
  me: Person | null;
  venues: Venue[];
  people: Person[];
  reviews: Review[];
  lists: DiningList[];
  items: { list_id: string; venue_id: string; position: number }[];
  saved: string[];
  bookmarks: string[];
  following: string[];
  likes: string[];
  visits: {
    venue_id: string;
    visited_at: string;
    visit_count?: number | null;
  }[];
  publicVisits: {
    user_id: string;
    venue_id: string;
    visit_count?: number | null;
  }[];
  integration: {
    configured: boolean;
    discovery: boolean;
    environment: string;
  };
};

export type FeedItem = {
  id: string;
  type: "checkin" | "review";
  occurred_at: string;
  visit_count: number | null;
  person: Person;
  venue: Venue;
  review?: Review;
};
