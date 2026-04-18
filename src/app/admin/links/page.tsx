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

  return <LinksManager email={session.email} />;
}
