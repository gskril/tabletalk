export type Person = {
  id: string;
  name: string;
  bio: string;
  color: string;
  demo: number;
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
  website: string;
  description: string;
  tags: string;
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
  visits: { venue_id: string; visited_at: string }[];
  integration: {
    configured: boolean;
    discovery: boolean;
    environment: string;
  };
};
