import {
  integer,
  real,
  text,
  sqliteTable,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    bio: text("bio").notNull().default(""),
    color: text("color").notNull().default("#ed563d"),
    demo: integer("demo").notNull().default(0),
    avatar: text("avatar").notNull().default(""),
    externalId: text("external_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("profiles_external").on(t.externalId)],
);
export const sessions = sqliteTable("sessions", {
  hash: text("hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  token: text("token"),
  tokenExpiresAt: integer("token_expires_at"),
  refreshToken: text("refresh_token"),
  refreshLease: text("refresh_lease").notNull().default(""),
  refreshLeaseUntil: integer("refresh_lease_until").notNull().default(0),
});
export const oauthStates = sqliteTable("oauth_states", {
  hash: text("hash").primaryKey(),
  verifier: text("verifier").notNull(),
  expiresAt: integer("expires_at").notNull(),
  returnTo: text("return_to").notNull(),
});
export const venues = sqliteTable("venues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  neighborhood: text("neighborhood").notNull(),
  address: text("address").notNull(),
  price: integer("price").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  image: text("image").notNull().default(""),
  website: text("website").notNull().default(""),
  description: text("description").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  source: text("source").notNull().default("demo"),
  updatedAt: text("updated_at").notNull(),
  imageThumb: text("image_thumb").notNull().default(""),
});
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id),
    rating: real("rating").notNull(),
    body: text("body").notNull(),
    dish: text("dish").notNull().default(""),
    visitedAt: text("visited_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("reviews_user_venue").on(t.userId, t.venueId),
    index("reviews_venue").on(t.venueId),
    index("reviews_created").on(t.createdAt),
  ],
);
export const lists = sqliteTable("lists", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  visibility: text("visibility").notNull().default("public"),
  color: text("color").notNull().default("#f5ce4f"),
  createdAt: text("created_at").notNull(),
});
export const listItems = sqliteTable(
  "list_items",
  {
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.venueId] })],
);
export const savedLists = sqliteTable(
  "saved_lists",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listId] })],
);
export const bookmarks = sqliteTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.venueId] })],
);
export const follows = sqliteTable(
  "follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetId] })],
);
export const likes = sqliteTable(
  "likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.reviewId] })],
);
export const visits = sqliteTable(
  "visits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id),
    visitedAt: text("visited_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.venueId] })],
);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const catalogCache = sqliteTable("catalog_cache", {
  environment: text("environment").primaryKey(),
  locationIds: text("location_ids").notNull().default("[]"),
  syncedAt: integer("synced_at").notNull().default(0),
  nextAttemptAt: integer("next_attempt_at").notNull().default(0),
  leaseToken: text("lease_token").notNull().default(""),
});
export const passportSyncs = sqliteTable("passport_syncs", {
  userId: text("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("syncing"),
  syncedAt: integer("synced_at"),
  nextAttemptAt: integer("next_attempt_at").notNull().default(0),
  leaseToken: text("lease_token").notNull().default(""),
  complete: integer("complete").notNull().default(1),
});
