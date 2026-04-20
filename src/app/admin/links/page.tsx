import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/admin-auth";
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
  // Links are cross-event. Scoped collaborators 403 at the API anyway;
  // bounce them back to the dashboard instead of rendering a shell that
  // immediately fails to load data.
  if (session.scope !== "all") {
    redirect("/admin");
  }

  return <LinksManager email={session.email} />;
}
