import type { Metadata } from "next";
import { DM_Serif_Display, Source_Sans_3 } from "next/font/google";
import "../../globals.css";

/**
 * Internal marketing-asset generator, not a public page. It sits outside
 * `[locale]` so it inherits no metadata at all, which left it indexable.
 * `noindex` here rather than a robots.txt `Disallow`, so the directive is
 * actually fetched and read.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export default function FlyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${dmSerif.variable} ${sourceSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
