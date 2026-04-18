import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Postgres extension required; enabled in the first migration.
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

// ============================================================
// events
// ============================================================
export const events = pgTable(
  "events",
  {
    id: text().primaryKey(),
    type: text().notNull(),
    series: text(),
    name: text().notNull(),
    date: timestamp({ withTimezone: true }).notNull(),
    capacity: integer(),
    status: text().notNull(),
    metadata: jsonb().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("events_status_check", sql`${t.status} IN ('upcoming','live','past','cancelled')`),
    index("events_type_idx").on(t.type),
    index("events_series_date_idx").on(t.series, t.date.desc()),
    index("events_date_idx").on(t.date.desc()),
    index("events_status_idx")
      .on(t.status)
      .where(sql`${t.status} IN ('upcoming','live')`),
  ],
);

// ============================================================
// people
// ============================================================
export const people = pgTable(
  "people",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    email: citext().unique(),
    name: text().notNull(),
    phone: text(),
    instagram: text(),
    language: text().notNull().default("es"),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    notes: text(),
    firstSeen: timestamp({ withTimezone: true }).notNull().defaultNow(),
    firstTouch: jsonb(),
    communicationOptIns: text()
      .array()
      .notNull()
      .default(sql`ARRAY['email:transactional','email:marketing']::text[]`),
    optedOutAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("people_language_check", sql`${t.language} IN ('es','en')`),
    check(
      "people_contact_check",
      sql`${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL OR ${t.instagram} IS NOT NULL`,
    ),
    index("people_created_at_idx").on(t.createdAt.desc()),
    index("people_first_seen_idx").on(t.firstSeen.desc()),
    index("people_tags_gin_idx").using("gin", t.tags),
    index("people_opt_ins_gin_idx").using("gin", t.communicationOptIns),
  ],
);

// ============================================================
// organizations
// ============================================================
export const organizations = pgTable(
  "organizations",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    type: text(),
    notes: text(),
    metadata: jsonb().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("organizations_type_idx").on(t.type)],
);

// ============================================================
// person_organizations (many-to-many)
// ============================================================
export const personOrganizations = pgTable(
  "person_organizations",
  {
    personId: bigint({ mode: "number" })
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    organizationId: bigint({ mode: "number" })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.personId, t.organizationId] })],
);

// ============================================================
// packages (schema only — purchase UX deferred)
// ============================================================
export const packages = pgTable("packages", {
  id: bigserial({ mode: "number" }).primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  participationsGranted: integer().notNull(),
  appliesToEventType: text(),
  appliesToSeries: text(),
  priceCents: integer(),
  currency: text(),
  validityDays: integer(),
  status: text().notNull().default("active"),
  metadata: jsonb().notNull().default({}),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("packages_status_check", sql`${t.status} IN ('active','archived')`),
]);

// ============================================================
// memberships (schema only — purchase UX deferred)
// ============================================================
export const memberships = pgTable(
  "memberships",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    personId: bigint({ mode: "number" })
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    packageId: bigint({ mode: "number" })
      .notNull()
      .references(() => packages.id, { onDelete: "restrict" }),
    purchasedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }),
    participationsUsed: integer().notNull().default(0),
    externalPaymentId: text(),
    priceCents: integer(),
    currency: text(),
    status: text().notNull().default("active"),
    metadata: jsonb().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "memberships_status_check",
      sql`${t.status} IN ('active','exhausted','expired','refunded','cancelled')`,
    ),
    index("memberships_person_idx").on(t.personId),
    index("memberships_status_idx").on(t.status),
  ],
);

// ============================================================
// links (Spec 03 — tracked short links)
// ============================================================
export const links = pgTable(
  "links",
  {
    slug: text().primaryKey(),
    destination: text().notNull(),
    label: text().notNull(),
    channel: text().notNull(),
    source: text().notNull(),
    medium: text().notNull(),
    campaign: text(),
    resourceUrl: text(),
    note: text(),
    createdDate: text().notNull(), // YYYY-MM-DD, the date embedded in slug
    createdBy: text().notNull(),
    status: text().notNull().default("active"),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("links_status_check", sql`${t.status} IN ('active','archived','disabled')`),
    index("links_channel_idx").on(t.channel),
    index("links_campaign_idx")
      .on(t.campaign)
      .where(sql`${t.campaign} IS NOT NULL`),
    index("links_created_at_idx").on(t.createdAt.desc()),
    index("links_status_idx").on(t.status),
  ],
);

// ============================================================
// link_clicks (append-only; bots filtered before insert)
// ============================================================
export const linkClicks = pgTable(
  "link_clicks",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    linkSlug: text()
      .notNull()
      .references(() => links.slug, { onDelete: "cascade" }),
    clickedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    userAgent: text(),
    referer: text(),
    ipHash: text(),
    isBot: boolean().notNull().default(false),
  },
  (t) => [
    index("link_clicks_slug_clicked_idx").on(t.linkSlug, t.clickedAt.desc()),
  ],
);

// ============================================================
// participations
// ============================================================
export const participations = pgTable(
  "participations",
  {
    id: text().primaryKey(),
    personId: bigint({ mode: "number" })
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    eventId: text()
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    buyerPersonId: bigint({ mode: "number" }).references(() => people.id, {
      onDelete: "restrict",
    }),
    role: text().notNull(),
    status: text().notNull().default("confirmed"),
    date: timestamp({ withTimezone: true }).notNull().defaultNow(),

    // attribution
    attribution: jsonb(),
    linkSlug: text().references(() => links.slug, { onDelete: "set null" }),

    // referrals
    referredByPersonId: bigint({ mode: "number" }).references(() => people.id, {
      onDelete: "set null",
    }),
    referralNote: text(),

    // payment
    externalPaymentId: text(),
    priceCents: integer(),
    currency: text(),
    membershipId: bigint({ mode: "number" }).references(() => memberships.id, {
      onDelete: "set null",
    }),

    // lifecycle
    usedAt: timestamp({ withTimezone: true }),
    metadata: jsonb().notNull().default({}),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "participations_status_check",
      sql`${t.status} IN ('pending','confirmed','waitlist','cancelled','no_show','used')`,
    ),
    uniqueIndex("participations_person_event_unique").on(t.personId, t.eventId),
    index("participations_event_id_idx").on(t.eventId),
    index("participations_person_id_idx").on(t.personId),
    index("participations_buyer_idx")
      .on(t.buyerPersonId)
      .where(sql`${t.buyerPersonId} IS NOT NULL`),
    index("participations_created_at_idx").on(t.createdAt.desc()),
    index("participations_link_slug_idx")
      .on(t.linkSlug)
      .where(sql`${t.linkSlug} IS NOT NULL`),
    index("participations_status_idx").on(t.status),
    index("participations_external_payment_idx")
      .on(t.externalPaymentId)
      .where(sql`${t.externalPaymentId} IS NOT NULL`),
    index("participations_referred_by_idx")
      .on(t.referredByPersonId)
      .where(sql`${t.referredByPersonId} IS NOT NULL`),
    index("participations_unresolved_refs_idx")
      .on(t.id)
      .where(sql`${t.referralNote} IS NOT NULL AND ${t.referredByPersonId} IS NULL`),
  ],
);

// Exported types for application code.
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Participation = typeof participations.$inferSelect;
export type NewParticipation = typeof participations.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;
export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
export type LinkClick = typeof linkClicks.$inferSelect;
export type NewLinkClick = typeof linkClicks.$inferInsert;
