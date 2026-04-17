/**
 * Spec 01, Phase 3 — one-shot migration from Redis entity data to Postgres.
 *
 * Usage:
 *   npx tsx scripts/migrate-redis-to-postgres.ts --dry-run
 *   npx tsx scripts/migrate-redis-to-postgres.ts --execute
 *
 * Reads from REDIS_URL and writes to DATABASE_URL. Designed to be idempotent
 * via ON CONFLICT DO NOTHING / ON CONFLICT DO UPDATE on the natural keys,
 * so re-runs are safe.
 *
 * Everything happens inside a single Postgres transaction. If any step
 * fails, the whole migration rolls back.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createHash } from "node:crypto";
import { createClient } from "redis";
import { sql } from "drizzle-orm";
// db is imported lazily inside main() — importing it at the top would
// trigger pool creation before dotenv has had a chance to populate
// DATABASE_URL (CJS require hoisting).

// ------------------------------------------------------------
// Args
// ------------------------------------------------------------
const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--execute");

if (!args.has("--dry-run") && !args.has("--execute")) {
  console.error("Pass --dry-run or --execute explicitly.");
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error("REDIS_URL is required.");
  process.exit(1);
}

// ------------------------------------------------------------
// Event seed data
// ------------------------------------------------------------
const BROTE_EVENT_ID = "brote-2026-03-28";
const PLANT_EVENT_ID = "plant-2026-04";

const today = new Date();
const PLANT_EVENT_DATE = new Date("2026-04-19T14:30:00-03:00");
const plantStatus = PLANT_EVENT_DATE < today ? "past" : "upcoming";

const seededEvents = [
  {
    id: BROTE_EVENT_ID,
    type: "brote",
    series: null as string | null,
    name: "BROTE — 28 de marzo 2026",
    date: new Date("2026-03-28T20:00:00-03:00"),
    capacity: null as number | null,
    status: "past",
  },
  {
    id: PLANT_EVENT_ID,
    type: "plant",
    series: null,
    name: "Plantación Abril 2026",
    date: PLANT_EVENT_DATE,
    capacity: 40,
    status: plantStatus,
  },
];

const seededOrgs = [
  { slug: "un-arbol", name: "Un Árbol", type: "ngo" as const, notes: "Tree-planting partner for BROTE" },
  { slug: "cima", name: "CIMA", type: "partner" as const, notes: "Partner org" },
];

// ------------------------------------------------------------
// Counters for the report
// ------------------------------------------------------------
const counts = {
  eventsInserted: 0,
  eventsSkipped: 0,
  orgsInserted: 0,
  orgsSkipped: 0,
  peopleInserted: 0,
  peopleUpdated: 0,
  broteParticipations: 0,
  plantParticipations: 0,
  waitlistParticipations: 0,
  sinergiaParticipations: 0,
  sinergiaEvents: 0,
  duplicatesSkipped: 0,
  warnings: [] as string[],
};

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function main() {
  const { db } = await import("../src/db/index");

  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();

  try {
    await db.transaction(async (tx) => {
      // 1. Seed non-Sinergia events.
      for (const e of seededEvents) {
        const res = await tx.execute<{ inserted: boolean }>(sql`
          INSERT INTO events (id, type, series, name, date, capacity, status)
          VALUES (${e.id}, ${e.type}, ${e.series}, ${e.name}, ${e.date.toISOString()}, ${e.capacity}, ${e.status})
          ON CONFLICT DO NOTHING
          RETURNING (xmax = 0) AS inserted
        `);
        if (res.rows.length > 0) counts.eventsInserted++;
        else counts.eventsSkipped++;
      }

      // 2. Discover + seed Sinergia events from Redis session keys.
      const sinergiaSessionKeys = await redis.keys("sinergia:session:*");
      const sessionDateRe = /^sinergia:session:(\d{4}-\d{2}-\d{2})$/;
      const sinergiaEventIds: string[] = [];
      const sinergiaCapacity = 15;
      for (const key of sinergiaSessionKeys) {
        const m = key.match(sessionDateRe);
        if (!m) continue; // skip :counter and :rsvps sub-keys
        const date = m[1];
        const eventId = `sinergia-${date}`;
        sinergiaEventIds.push(eventId);
        const eventDate = new Date(`${date}T19:30:00-03:00`);
        const status = eventDate < today ? "past" : "upcoming";
        const res = await tx.execute<{ inserted: boolean }>(sql`
          INSERT INTO events (id, type, series, name, date, capacity, status)
          VALUES (
            ${eventId},
            'sinergia',
            'sinergia',
            ${"Sinergia — " + date},
            ${eventDate.toISOString()},
            ${sinergiaCapacity},
            ${status}
          )
          ON CONFLICT DO NOTHING
          RETURNING (xmax = 0) AS inserted
        `);
        if (res.rows.length > 0) {
          counts.eventsInserted++;
          counts.sinergiaEvents++;
        } else {
          counts.eventsSkipped++;
        }
      }

      // 3. Seed organizations.
      for (const o of seededOrgs) {
        const res = await tx.execute<{ inserted: boolean }>(sql`
          INSERT INTO organizations (slug, name, type, notes)
          VALUES (${o.slug}, ${o.name}, ${o.type}, ${o.notes})
          ON CONFLICT (slug) DO NOTHING
          RETURNING (xmax = 0) AS inserted
        `);
        if (res.rows.length > 0) counts.orgsInserted++;
        else counts.orgsSkipped++;
      }

      // 4. BROTE tickets.
      const broteKeys = await redis.keys("brote:ticket:*");
      for (const key of broteKeys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        let t: {
          id: string;
          paymentId: string;
          buyerEmail: string;
          buyerName: string;
          status: "valid" | "used";
          createdAt: string;
          usedAt?: string;
          emailSent?: boolean;
          coffeeRedeemed?: boolean;
          coffeeRedeemedAt?: string;
        };
        try {
          t = JSON.parse(raw);
        } catch {
          counts.warnings.push(`BROTE ticket key ${key} has invalid JSON`);
          continue;
        }
        if (!t.buyerEmail || !t.id) {
          counts.warnings.push(`BROTE ticket ${key} missing email or id`);
          continue;
        }

        const personId = await upsertPersonTx(tx, {
          email: t.buyerEmail,
          name: t.buyerName || t.buyerEmail,
          firstSeenAt: t.createdAt,
        });

        const metadata: Record<string, unknown> = {};
        if (t.emailSent) metadata.emailSent = true;
        if (t.coffeeRedeemed) metadata.coffeeRedeemed = true;
        if (t.coffeeRedeemedAt) metadata.coffeeRedeemedAt = t.coffeeRedeemedAt;

        const res = await tx.execute(sql`
          INSERT INTO participations (
            id, person_id, event_id, buyer_person_id,
            role, status, date,
            external_payment_id, used_at, metadata,
            created_at, updated_at
          ) VALUES (
            ${t.id}, ${personId}, ${BROTE_EVENT_ID}, ${personId},
            'attendee',
            ${t.status === "used" ? "used" : "confirmed"},
            ${t.createdAt},
            ${t.paymentId ?? null},
            ${t.usedAt ?? null},
            ${JSON.stringify(metadata)}::jsonb,
            ${t.createdAt},
            ${t.createdAt}
          )
          ON CONFLICT DO NOTHING
        `);
        if (res.rowCount && res.rowCount > 0) {
          counts.broteParticipations++;
        } else {
          counts.duplicatesSkipped++;
          counts.warnings.push(
            `BROTE duplicate: ${t.id} (${t.buyerEmail}) — same person already has a BROTE participation`,
          );
        }
      }

      // 5. Plant registrations.
      const plantKeys = await redis.keys("plant:registration:*");
      for (const key of plantKeys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        let r: {
          id: string;
          email: string;
          name: string;
          groupType: string;
          carpool: boolean;
          message?: string;
          createdAt: string;
          utm?: { source?: string; medium?: string; campaign?: string };
        };
        try {
          r = JSON.parse(raw);
        } catch {
          counts.warnings.push(`Plant registration ${key} has invalid JSON`);
          continue;
        }
        if (!r.email || !r.id) {
          counts.warnings.push(`Plant registration ${key} missing email or id`);
          continue;
        }

        const attribution = r.utm
          ? {
              source: r.utm.source,
              medium: r.utm.medium,
              campaign: r.utm.campaign,
              capturedAt: r.createdAt,
            }
          : null;

        const personId = await upsertPersonTx(tx, {
          email: r.email,
          name: r.name || r.email,
          firstSeenAt: r.createdAt,
          firstTouch: attribution,
        });

        const metadata: Record<string, unknown> = {
          groupType: r.groupType,
          carpool: r.carpool,
        };
        if (r.message) metadata.message = r.message;

        const res = await tx.execute(sql`
          INSERT INTO participations (
            id, person_id, event_id, buyer_person_id,
            role, status, date,
            attribution, metadata,
            created_at, updated_at
          ) VALUES (
            ${r.id}, ${personId}, ${PLANT_EVENT_ID}, ${personId},
            'planter', 'confirmed',
            ${r.createdAt},
            ${attribution ? JSON.stringify(attribution) : null}::jsonb,
            ${JSON.stringify(metadata)}::jsonb,
            ${r.createdAt},
            ${r.createdAt}
          )
          ON CONFLICT DO NOTHING
        `);
        if (res.rowCount && res.rowCount > 0) counts.plantParticipations++;
        else counts.duplicatesSkipped++;
      }

      // 6. Plant waitlist.
      const waitlistRaw = await redis.sMembers("plant:waitlist");
      for (const raw of waitlistRaw) {
        let w: { email: string; createdAt: string };
        try {
          w = JSON.parse(raw);
        } catch {
          counts.warnings.push(`Plant waitlist entry has invalid JSON`);
          continue;
        }
        if (!w.email) {
          counts.warnings.push(`Plant waitlist entry missing email`);
          continue;
        }

        const personId = await upsertPersonTx(tx, {
          email: w.email,
          name: w.email, // no name captured on waitlist
          firstSeenAt: w.createdAt,
        });

        // Deterministic id so re-runs are idempotent.
        const hash = createHash("sha1").update(w.email.toLowerCase()).digest("hex");
        const waitlistId = `PLANT-WL-${hash.slice(0, 8).toUpperCase()}`;

        const res = await tx.execute(sql`
          INSERT INTO participations (
            id, person_id, event_id, buyer_person_id,
            role, status, date, created_at, updated_at
          ) VALUES (
            ${waitlistId}, ${personId}, ${PLANT_EVENT_ID}, ${personId},
            'planter', 'waitlist',
            ${w.createdAt}, ${w.createdAt}, ${w.createdAt}
          )
          ON CONFLICT DO NOTHING
        `);
        if (res.rowCount && res.rowCount > 0) counts.waitlistParticipations++;
        else counts.duplicatesSkipped++;
      }

      // 7. Sinergia RSVPs.
      const sinergiaRsvpKeys = await redis.keys("sinergia:rsvp:*");
      for (const key of sinergiaRsvpKeys) {
        // Skip erratum-sent flags: key shape is sinergia:rsvp:{id}:erratum-sent
        if (key.endsWith(":erratum-sent")) continue;

        const raw = await redis.get(key);
        if (!raw) continue;
        let r: {
          id: string;
          sessionDate: string;
          email: string;
          name: string;
          staysForDinner: boolean;
          createdAt: string;
          status: string;
        };
        try {
          r = JSON.parse(raw);
        } catch {
          counts.warnings.push(`Sinergia RSVP ${key} has invalid JSON`);
          continue;
        }
        if (!r.email || !r.id || !r.sessionDate) {
          counts.warnings.push(`Sinergia RSVP ${key} missing required fields`);
          continue;
        }

        const eventId = `sinergia-${r.sessionDate}`;
        if (!sinergiaEventIds.includes(eventId)) {
          // The RSVP references a session date that had no sinergia:session:*
          // key (shouldn't normally happen, but handle gracefully).
          counts.warnings.push(
            `RSVP ${r.id} references missing session ${r.sessionDate} — seeding event`,
          );
          const seedDate = new Date(`${r.sessionDate}T19:30:00-03:00`);
          const status = seedDate < today ? "past" : "upcoming";
          await tx.execute(sql`
            INSERT INTO events (id, type, series, name, date, capacity, status)
            VALUES (${eventId}, 'sinergia', 'sinergia', ${"Sinergia — " + r.sessionDate}, ${seedDate.toISOString()}, ${15}, ${status})
            ON CONFLICT DO NOTHING
          `);
          sinergiaEventIds.push(eventId);
        }

        const personId = await upsertPersonTx(tx, {
          email: r.email,
          name: r.name || r.email,
          firstSeenAt: r.createdAt,
        });

        const metadata = { staysForDinner: r.staysForDinner };

        const res = await tx.execute(sql`
          INSERT INTO participations (
            id, person_id, event_id, buyer_person_id,
            role, status, date, metadata,
            created_at, updated_at
          ) VALUES (
            ${r.id}, ${personId}, ${eventId}, ${personId},
            'rsvp', 'confirmed',
            ${r.createdAt},
            ${JSON.stringify(metadata)}::jsonb,
            ${r.createdAt}, ${r.createdAt}
          )
          ON CONFLICT DO NOTHING
        `);
        if (res.rowCount && res.rowCount > 0) counts.sinergiaParticipations++;
        else counts.duplicatesSkipped++;
      }

      // 8. Roll back if dry-run.
      if (DRY_RUN) {
        throw new DryRunAbort();
      }
    });
  } catch (err) {
    if (err instanceof DryRunAbort) {
      console.log("\n[DRY RUN] Transaction rolled back. No changes persisted.");
    } else {
      throw err;
    }
  } finally {
    await redis.quit();
  }

  // Report.
  console.log("\n=== Migration report ===");
  console.log(`Mode:                   ${DRY_RUN ? "DRY RUN (rolled back)" : "EXECUTED"}`);
  console.log(`Events inserted:        ${counts.eventsInserted}`);
  console.log(`Events already present: ${counts.eventsSkipped}`);
  console.log(`  of which Sinergia:    ${counts.sinergiaEvents}`);
  console.log(`Orgs inserted:          ${counts.orgsInserted}`);
  console.log(`Orgs already present:   ${counts.orgsSkipped}`);
  console.log(`People inserted:        ${counts.peopleInserted}`);
  console.log(`People updated:         ${counts.peopleUpdated}`);
  console.log(`BROTE participations:   ${counts.broteParticipations}`);
  console.log(`Plant participations:   ${counts.plantParticipations}`);
  console.log(`Waitlist participations:${counts.waitlistParticipations}`);
  console.log(`Sinergia participations:${counts.sinergiaParticipations}`);
  console.log(`Duplicate rows skipped: ${counts.duplicatesSkipped}`);
  console.log(`Warnings:               ${counts.warnings.length}`);
  for (const w of counts.warnings) console.log(`  - ${w}`);
}

class DryRunAbort extends Error {
  constructor() {
    super("dry run");
    this.name = "DryRunAbort";
  }
}

/**
 * Transaction-scoped person upsert. Uses xmax to distinguish inserts from
 * updates so the report is accurate. Merges firstSeen / firstTouch only when
 * the row is newly inserted; otherwise leaves them untouched.
 */
async function upsertPersonTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  params: {
    email: string;
    name: string;
    firstSeenAt: string;
    firstTouch?: unknown;
  },
): Promise<number> {
  const email = params.email.trim();
  const res = await tx.execute(sql`
    INSERT INTO people (email, name, first_seen, first_touch)
    VALUES (
      ${email},
      ${params.name},
      ${params.firstSeenAt},
      ${params.firstTouch ? JSON.stringify(params.firstTouch) : null}::jsonb
    )
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(NULLIF(people.name, ''), EXCLUDED.name),
      -- First-seen wins: if the new row has an earlier createdAt, push back.
      first_seen = LEAST(people.first_seen, EXCLUDED.first_seen),
      -- first_touch only set if missing.
      first_touch = COALESCE(people.first_touch, EXCLUDED.first_touch),
      updated_at = NOW()
    RETURNING id, (xmax = 0) AS was_inserted
  `);
  const row = res.rows[0];
  if (!row) throw new Error("upsert returned no rows for " + email);
  if (row.was_inserted) counts.peopleInserted++;
  else counts.peopleUpdated++;
  return Number(row.id);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
