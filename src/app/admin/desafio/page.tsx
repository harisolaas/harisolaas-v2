import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { DESAFIO_EVENT_ID } from "@/data/desafio";
import DesafioManager from "@/components/admin/DesafioManager";

export const metadata = {
  title: "Desafío",
};

export default async function AdminDesafioPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    redirect("/admin/login");
  }

  const session = await validateSession(sessionCookie.value);
  if (!session) {
    redirect("/admin/login");
  }

  // Scoped collaborators only get in when the desafío is one of their
  // events — the API enforces the same rule, this just avoids a dead page.
  if (
    session.scope === "scoped" &&
    !session.allowedEventIds.includes(DESAFIO_EVENT_ID)
  ) {
    redirect("/admin");
  }

  return (
    <DesafioManager
      email={session.email}
      canWrite={session.role !== "viewer"}
    />
  );
}
