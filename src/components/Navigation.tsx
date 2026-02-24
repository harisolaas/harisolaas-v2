"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Dictionary } from "@/dictionaries/types";

interface NavigationProps {
  locale: string;
  dict: Dictionary["nav"];
}

export default function Navigation({ locale, dict }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navLinks = [
    { label: dict.values, href: "#outlive" },
    { label: dict.now, href: "#now" },
    { label: dict.story, href: "#timeline" },
    { label: dict.contact, href: "#contact" },
  ];

  const otherLocale = locale === "en" ? "es" : "en";
  const localeLabel = locale === "en" ? "ES" : "EN";

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-cream/90 shadow-sm backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a
            href="#hero"
            className={`font-serif text-lg transition-colors ${
              isScrolled ? "text-forest" : "text-forest/80"
            }`}
          >
            {dict.brand}
          </a>

          {/* Desktop nav */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  isScrolled
                    ? "text-charcoal/60 hover:text-forest"
                    : "text-charcoal/50 hover:text-forest"
                }`}
              >
                {link.label}
              </a>
            ))}
            <a
              href={`/${otherLocale}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                isScrolled
                  ? "border-forest/20 text-forest hover:bg-forest/5"
                  : "border-forest/15 text-forest/70 hover:bg-forest/5"
              }`}
            >
              {localeLabel}
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label={dict.toggleMenu}
          >
            <motion.span
              animate={
                isMobileOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }
              }
              className="block h-0.5 w-5 bg-forest"
            />
            <motion.span
              animate={isMobileOpen ? { opacity: 0 } : { opacity: 1 }}
              className="block h-0.5 w-5 bg-forest"
            />
            <motion.span
              animate={
                isMobileOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }
              }
              className="block h-0.5 w-5 bg-forest"
            />
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-cream/95 backdrop-blur-md md:hidden"
          >
            <div className="flex min-h-svh flex-col items-center justify-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="font-serif text-3xl text-forest transition-colors hover:text-terracotta"
                >
                  {link.label}
                </a>
              ))}
              <a
                href={`/${otherLocale}`}
                className="rounded-full border border-forest/20 px-5 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest/5"
              >
                {localeLabel}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
