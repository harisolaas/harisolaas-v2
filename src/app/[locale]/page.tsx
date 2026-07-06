import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import ConsoleSignature from "@/components/ConsoleSignature";
import Cursor from "@/components/Cursor";
import Navigation from "@/components/Navigation";
import SmoothScroll from "@/components/SmoothScroll";
import Hero from "@/components/Hero";
import ValueSection from "@/components/ValueSection";
import NowSection from "@/components/NowSection";
import Timeline from "@/components/Timeline";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return (
    <>
      <SmoothScroll />
      <Cursor />
      <ConsoleSignature />
      <Navigation locale={locale} dict={dict.nav} />
      <main>
        <Hero dict={dict.hero} />
        {dict.values.map((value, index) => (
          <ValueSection
            key={value.id}
            value={value}
            index={index}
            total={dict.values.length}
            prevVariant={index === 0 ? "cream" : dict.values[index - 1].variant}
          />
        ))}
        <NowSection dict={dict.now} />
        <Timeline dict={dict.timeline} />
        <Contact dict={dict.contact} />
      </main>
      <Footer dict={dict.footer} />
    </>
  );
}
