import { DM_Serif_Display, Source_Sans_3 } from "next/font/google";
import "../../globals.css";

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
