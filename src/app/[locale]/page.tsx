import { existsSync } from "fs";
import { join } from "path";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import ConsoleSignature from "@/components/ConsoleSignature";
import Cursor from "@/components/Cursor";
import Navigation from "@/components/Navigation";
import SmoothScroll from "@/components/SmoothScroll";
import Hero from "@/components/Hero";
import ImpactSection from "@/components/ImpactSection";
import ValueSection from "@/components/ValueSection";
import BeyondSection from "@/components/BeyondSection";
import NowSection from "@/components/NowSection";
// Timeline ("The Full Story") hidden for now — restore this import and the
// <Timeline> render below (plus the nav link in Navigation.tsx) to bring it back.
// import Timeline from "@/components/Timeline";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { fillTokens } from "@/data/brote";
import { desafioPhase, desafioStartDate, formatDayDate } from "@/data/desafio";
import { resolveDesafioNowItem } from "@/lib/desafio";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  // Speaking photo ships separately — placeholder renders until it lands
  const hasSpeakingPhoto = existsSync(
    join(process.cwd(), "public", "speaking.jpg")
  );
  // The desafío card's `{date}` comes from the same start date the /desafio
  // landing uses, so moving the date in config can't leave this card stale.
  const desafioDate = formatDayDate(
    desafioStartDate(),
    locale === "en" ? "en" : "es",
  );
  // The card's copy is phase-aware ("Arranca el…" → "Empezó el…" →
  // "Terminó"). This page is statically generated, so the phase is the one
  // at build time: it follows the challenge on each deploy, not live.
  const phase = desafioPhase();
  const nowDict = {
    ...dict.now,
    items: dict.now.items.map((raw) => {
      const item = resolveDesafioNowItem(raw, phase);
      return {
        ...item,
        description: fillTokens(item.description, { date: desafioDate }),
      };
    }),
  };

  return (
    <>
      <SmoothScroll />
      <Cursor />
      <ConsoleSignature />
      <Navigation locale={locale} dict={dict.nav} />
      <main>
        <Hero dict={dict.hero} />
        <ImpactSection dict={dict.impact} />
        {dict.values.map((value, index) => (
          <ValueSection
            key={value.id}
            value={value}
            index={index}
            total={dict.values.length}
            prevVariant={index === 0 ? "cream" : dict.values[index - 1].variant}
          />
        ))}
        <BeyondSection dict={dict.beyond} hasPhoto={hasSpeakingPhoto} />
        <NowSection dict={nowDict} />
        {/* Timeline ("The Full Story") hidden for now — restore to bring it back */}
        {/* <Timeline dict={dict.timeline} /> */}
        <Contact dict={dict.contact} />
      </main>
      <Footer dict={dict.footer} />
    </>
  );
}
