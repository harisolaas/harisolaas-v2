"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { fadeUp, heroStagger } from "@/lib/animations";

export default function Hero() {
  return (
    <section
      id="hero"
      className="texture-overlay relative flex min-h-svh items-center justify-center bg-cream px-6"
    >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={heroStagger}
        className="relative z-10 flex max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-16"
      >
        {/* Text — left on desktop, below photo on mobile */}
        <div className="order-2 text-center lg:order-1 lg:flex-1 lg:text-left">
          <motion.h1
            variants={fadeUp}
            className="font-serif text-5xl text-forest md:text-7xl lg:text-8xl"
          >
            Harald Solaas
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-xl font-serif text-lg italic leading-relaxed text-charcoal/70 md:text-xl lg:mx-0 lg:text-2xl"
          >
            I started meditating at 15, teaching in slums at 17, and writing
            code at 20. I haven&rsquo;t stopped doing any of them.
          </motion.p>
        </div>

        {/* Portrait — right on desktop, top on mobile */}
        <motion.div variants={fadeUp} className="order-1 lg:order-2">
          <div className="h-[200px] w-[200px] overflow-hidden rounded-full shadow-lg md:h-[280px] md:w-[280px] lg:h-[340px] lg:w-[340px]">
            <Image
              src="/hari.jpg"
              alt="Harald Solaas"
              width={340}
              height={340}
              priority
              className="h-full w-full object-cover"
              style={{
                filter:
                  "brightness(1.02) saturate(0.95) sepia(0.08)",
              }}
            />
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2"
      >
        <a
          href="#outlive"
          className="flex flex-col items-center gap-2 text-sage/70 transition-colors hover:text-forest"
        >
          <span className="text-xs uppercase tracking-widest">
            Scroll to meet me
          </span>
          <motion.svg
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </motion.svg>
        </a>
      </motion.div>
    </section>
  );
}
