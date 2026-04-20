import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import ComunidadShell from "@/components/admin/ComunidadShell";

export const metadata = {
  title: "Comunidad",
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    redirect("/admin/login");
  }

  const session = await validateSession(sessionCookie.value);
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <ComunidadShell
      email={session.email}
      role={session.role}
      scope={session.scope}
    />
  );
}
