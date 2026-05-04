import "server-only";
import { and, isNotNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { KnownDestination } from "@/lib/links";

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
// anyone maintaining a static list. Cancelled events are excluded;
// home (/es) is always included at the top, and de-duped against any
// event row that happens to also point at /es.
export async function getKnownDestinations(): Promise<KnownDestination[]> {
  const rows = await db
    .selectDistinct({ landingPath: schema.events.landingPath })
    .from(schema.events)
    .where(
      and(
        isNotNull(schema.events.landingPath),
        ne(schema.events.status, "cancelled"),
      ),
    )
    .orderBy(sql`${schema.events.landingPath} ASC`);

  const eventDestinations = rows
    .map((r) => r.landingPath)
    .filter((p): p is string => Boolean(p) && p !== "/es")
    .map((path) => ({ path, display: formatDestinationLabel(path) }));

  return [{ path: "/es", display: "Home (/es)" }, ...eventDestinations];
}
