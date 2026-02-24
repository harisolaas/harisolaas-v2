export interface ProofPoint {
  label: string;
  title: string;
  description: string;
  metrics?: Array<{ value: string; label: string }>;
}

export interface ValueData {
  id: string;
  statement: string;
  proofPoints: ProofPoint[];
  quote?: { text: string };
  photoAlt: string;
  photoSrc: string;
  photoPosition?: string;
  variant: "cream" | "tan" | "forest";
}

export type NowCategoryKey =
  | "teaching"
  | "building"
  | "community"
  | "personal";

export interface NowItem {
  categoryKey: NowCategoryKey;
  categoryLabel: string;
  title: string;
  description: string;
  status: string;
  cta: { label: string; href: string };
}

export interface TimelineEntry {
  year: string;
  title: string;
  description: string;
  type: "life" | "work" | "community";
}

export interface Dictionary {
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    twitterTitle: string;
    twitterDescription: string;
  };
  nav: {
    brand: string;
    values: string;
    now: string;
    story: string;
    contact: string;
    toggleMenu: string;
  };
  hero: {
    name: string;
    tagline: string;
    scrollCta: string;
    photoAlt: string;
  };
  values: ValueData[];
  now: {
    heading: string;
    subheading: string;
    items: NowItem[];
  };
  timeline: {
    heading: string;
    subheading: string;
    expand: string;
    collapse: string;
    techHeading: string;
    entries: TimelineEntry[];
    technologies: string[];
  };
  contact: {
    heading: string;
    description: string;
    caseStudyLabel: string;
    linkLabels: Record<string, string>;
  };
  footer: {
    copyright: string;
  };
}
