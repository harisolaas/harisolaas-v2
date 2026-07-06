import type { Variants } from "framer-motion";

/**
 * Custom easing curves — the house motion vocabulary.
 * Expo/quart curves start fast and settle long, which reads far more
 * deliberate than the default easeOut. Use these everywhere; never "easeOut".
 */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeOutQuart = [0.25, 1, 0.5, 1] as const;
export const easeInOutQuint = [0.83, 0, 0.17, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: easeOutExpo },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1, ease: easeOutQuart } },
};

export const fadeUpSlow: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.1, ease: easeOutExpo },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

export const heroStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.2, delayChildren: 0.3 },
  },
};

