import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import ValueSection from "@/components/ValueSection";
import NowSection from "@/components/NowSection";
import Timeline from "@/components/Timeline";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { values } from "@/data/values";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        {values.map((value, index) => (
          <ValueSection key={value.id} value={value} index={index} />
        ))}
        <NowSection />
        <Timeline />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
