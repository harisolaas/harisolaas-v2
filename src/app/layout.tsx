import type { Metadata } from "next";
import { DM_Serif_Display, Source_Sans_3 } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Harald Solaas — Technology that serves people",
  description:
    "Senior Software Engineer & Technology Consultant. I build technology that serves people — and communities that outlive me.",
  keywords: [
    "Harald Solaas",
    "Hari Solaas",
    "Senior Software Engineer",
    "Technology Consultant",
    "React",
    "Next.js",
    "Full Stack Developer",
  ],
  authors: [{ name: "Harald Solaas" }],
  openGraph: {
    title: "Harald Solaas — Technology that serves people",
    description:
      "Senior Software Engineer & Technology Consultant. Building technology that serves people and communities that outlive me.",
    url: "https://harisolaas.com",
    siteName: "Harald Solaas",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Harald Solaas — Technology that serves people",
    description:
      "Senior Software Engineer & Technology Consultant. Building technology that serves people.",
  },
  metadataBase: new URL("https://harisolaas.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${sourceSans.variable}`}>
      <head>
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: `[style]{opacity:1!important;transform:none!important;height:auto!important}`,
            }}
          />
        </noscript>
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
