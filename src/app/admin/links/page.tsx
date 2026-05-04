import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { getKnownDestinations } from "@/lib/links-server";
import LinksManager from "@/components/admin/LinksManager";

export default async function AdminLinksPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    redirect("/admin/login");
  }

  const session = await validateSession(sessionCookie.value);
  if (!session) {
    redirect("/admin/login");
  }

  // Destinations are filtered to the user's scoped events when
  // scope='scoped'; owners + scope='all' editors get the full list
  // (Home included). Callers will see Home + non-event landings only
  // for scope='all' sessions.
  const destinations = await getKnownDestinations(session);

  // Write actions need editor+ AND either scope='all' or at least one
  // accessible destination. Scoped viewers (any scope) and scoped
  // users with no event grants can only browse.
  const canCreate =
    session.role !== "viewer" &&
    (session.scope === "all" || destinations.length > 0);

  return (
    <LinksManager
      email={session.email}
      destinations={destinations}
      canCreate={canCreate}
      allowCustomDestination={session.scope === "all"}
    />
  );
}
