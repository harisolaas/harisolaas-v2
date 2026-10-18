import { Lexend_Exa, Orbitron, Share_Tech_Mono } from "next/font/google";

// The design system's type (Google substitutes for the flyer's faces),
// loaded only by the hackea pages. hackea.css maps them to --font-display /
// --font-text / --font-digital.
const orbitron = Orbitron({
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-htm-display",
  display: "swap",
});

const lexendExa = Lexend_Exa({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-htm-text",
  display: "swap",
});

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-htm-digital",
  display: "swap",
});

export const hackeaFontClassName = `${orbitron.variable} ${lexendExa.variable} ${shareTechMono.variable}`;
