import { DM_Serif_Display, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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

export default function NotFound() {
  return (
    <html lang="en" className={`${dmSerif.variable} ${sourceSans.variable}`}>
      <body className="font-sans antialiased bg-cream text-charcoal">
        <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <h1 className="font-serif text-6xl md:text-8xl text-forest mb-4">
            404
          </h1>
          <p className="font-serif text-2xl md:text-3xl text-forest mb-6">
            This page doesn&apos;t exist yet.
          </p>
          <p className="text-lg text-charcoal/70 mb-10 max-w-md">
            Maybe it will someday — I&apos;m always building something. For now,
            let&apos;s get you back.
          </p>
          <Link
            href="/en"
            className="inline-block px-8 py-3 bg-terracotta text-cream rounded-full text-lg font-medium hover:bg-terracotta/90 transition-colors"
          >
            Back to Home
          </Link>
        </main>
      </body>
    </html>
  );
}
