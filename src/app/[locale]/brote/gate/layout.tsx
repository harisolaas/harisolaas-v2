import type { Metadata } from "next";

/**
 * The door scanner. It exists only for whoever is working the entrance, and it
 * is linked from every buyer's ticket email
 * (`src/lib/brote-ticket-email.ts`), so it has real inbound links and would
 * otherwise be crawled and indexed.
 *
 * The rule lives here rather than in `robots.ts`: a path blocked in robots.txt
 * is never fetched, so its `noindex` is never read, and Google can still index
 * the bare URL on the strength of those inbound links. `noindex` is only
 * obeyed if the crawler is allowed to see it.
 *
 * A layout rather than the page itself because `gate/page.tsx` is a client
 * component, and those cannot export `metadata`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function BroteGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
