import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import AccessShell from "@/components/admin/AccessShell";

export const metadata = {
  title: "Acceso",
};

export default async function AccessPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) redirect("/admin/login");

  const session = await validateSession(sessionCookie.value);
  if (!session) redirect("/admin/login");
  // Non-owners shouldn't even see the page UI; the APIs 403 them anyway.
  if (session.role !== "owner") redirect("/admin");

  return <AccessShell email={session.email} currentUserId={session.userId} />;
}
