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

  // Read access is enforced at the API: a scoped user without event
  // access to this link gets a 404 when LinkDetail fetches it. By the
  // time the data arrives, read access is guaranteed — so write
  // gating reduces to the role check.
  const canWrite = session.role !== "viewer";

  const { slug } = await params;
  return <LinkDetail slug={slug} email={session.email} canWrite={canWrite} />;
}
