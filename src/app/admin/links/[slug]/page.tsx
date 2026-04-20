import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import LinkDetail from "@/components/admin/LinkDetail";

export default async function AdminLinkDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    redirect("/admin/login");
  }

  const session = await validateSession(sessionCookie.value);
  if (!session) {
    redirect("/admin/login");
  }
  if (session.scope !== "all") {
    redirect("/admin");
  }

  const { slug } = await params;
  return <LinkDetail slug={slug} email={session.email} />;
}
