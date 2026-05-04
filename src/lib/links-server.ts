import "server-only";
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { KnownDestination } from "@/lib/links";
import type { AdminSession } from "@/lib/admin-auth";

const SITE_BASE_URL = "https://www.harisolaas.com";

// Strip the site origin + any query/hash so we can compare a link's
// `destination` field (which can be a full URL or a path) to
// `events.landing_path` (always a path) on equal terms. Returns the
// path-only form, or the original string if it can't be parsed.
function normalizeDestinationToPath(destination: string): string {
  try {
    const url = destination.startsWith("http")
      ? new URL(destination)
      : new URL(destination, SITE_BASE_URL);
    return url.pathname || destination;
  } catch {
    return destination;
  }
}

// Display labels for landing paths. Cosmetic — adding an entry just
// makes the admin link-creator dropdown read nicer; the URL works
// either way (unknown paths fall back to a humanised tail segment).
const PATH_DISPLAY_NAMES: Record<string, string> = {
  "/es/brote": "BROTE",
  "/es/sinergia": "Sinergia",
  "/es/sinergia-parrafo": "Sinergia × Párrafo",
};

function humanizePath(path: string): string {
  const tail = path.split("/").filter(Boolean).pop() ?? path;
  return tail
    .split("-")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

function formatDestinationLabel(path: string): string {
  const name = PATH_DISPLAY_NAMES[path] ?? humanizePath(path);
  return `${name} (${path})`;
}

// Reads distinct non-null landing paths from the events table so the
// admin link-creator dropdown picks up every event landing without
// anyone maintaining a static list. Cancelled events are excluded.
//
// When a session is passed and it's `scope='scoped'`, the result is
// restricted to landings whose event id is in the user's
// `allowedEventIds`, and Home (/es) is dropped — scoped collaborators
// only see destinations they have event-level access to. For
// `scope='all'` (or no session), Home is prepended and the full list
// is returned (de-duped against any event row that happens to point
// at /es).
export async function getKnownDestinations(
  session?: AdminSession,
): Promise<KnownDestination[]> {
  const isScoped = session?.scope === "scoped";

  const baseConditions = [
    isNotNull(schema.events.landingPath),
    ne(schema.events.status, "cancelled"),
  ];

  if (isScoped) {
    if (session.allowedEventIds.length === 0) {
      // Scoped user with no event grants — nothing to show. Home is
      // owner-only, so the dropdown comes back empty (the form will
      // render with no options + no custom-path escape hatch for
      // scoped users; see callers).
      return [];
    }
    baseConditions.push(inArray(schema.events.id, session.allowedEventIds));
  }

  const rows = await db
    .selectDistinct({ landingPath: schema.events.landingPath })
    .from(schema.events)
    .where(and(...baseConditions))
    .orderBy(sql`${schema.events.landingPath} ASC`);

  const eventDestinations = rows
    .map((r) => r.landingPath)
    .filter((p): p is string => Boolean(p) && p !== "/es")
    .map((path) => ({ path, display: formatDestinationLabel(path) }));

  if (isScoped) {
    // Home (/es) is owner-only per the access policy.
    return eventDestinations;
  }
  return [{ path: "/es", display: "Home (/es)" }, ...eventDestinations];
}

// Returns the ids of non-cancelled events whose `landing_path` matches
// the given destination (after normalization). One landing can map to
// many events (e.g. weekly Sinergia sessions all share /es/sinergia)
// so this is a list. Returns an empty array for home (/es), custom
// paths that don't match any event, and unparseable destinations.
export async function eventIdsForDestination(
  destination: string,
): Promise<string[]> {
  const path = normalizeDestinationToPath(destination);
  if (!path) return [];

  const rows = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.landingPath, path),
        ne(schema.events.status, "cancelled"),
      ),
    );

  return rows.map((r) => r.id);
}

// True iff the scoped session has access to manage links pointing at
// `destination`. The check is union-based: if the destination matches
// any event landing the user is scoped to, access is granted. Returns
// false for home + custom destinations (no matching event = no scoped
// access; those stay owner-only). Callers must short-circuit for
// `session.scope === 'all'` BEFORE calling this — owners always have
// access regardless of the destination.
export async function canScopedAccessLink(
  session: AdminSession,
  destination: string,
): Promise<boolean> {
  if (session.scope !== "scoped") {
    // Defensive — callers should branch first, but if they don't, we
    // grant access (matches the existing `assertFullAccess` semantics).
    return true;
  }
  if (session.allowedEventIds.length === 0) return false;
  const matchingIds = await eventIdsForDestination(destination);
  if (matchingIds.length === 0) return false;
  const allowed = new Set(session.allowedEventIds);
  return matchingIds.some((id) => allowed.has(id));
}
