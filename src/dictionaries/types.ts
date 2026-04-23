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

export interface BroteExperienceItem {
  icon: string;
  title: string;
  description: string;
  subtitle?: string;
}

export interface BroteLineupItem {
  time: string;
  title: string;
  description: string;
  link?: { url: string; label: string };
}

export interface BroteDict {
  meta: { title: string; description: string; ogDescription: string };
  hero: {
    subtitle: string;
    dateTime: string;
    subhead: string;
    cta: string;
  };
  experience: BroteExperienceItem[];
  lineup: {
    toggle: string;
    items: BroteLineupItem[];
  };
  impact: {
    heading: string;
    partner: { intro: string; name: string; rest: string };
    body: string;
    attendees: string;
    partnerLabel: string;
  };
  pricing: {
    reanchor: string;
    cta: string;
    payment: string;
    earlyBirdBadge: string;
    earlyBirdUntil: string;
  };
  about: {
    intro: { before: string; sponsors: string; after: string };
    body: string;
    closing: string;
  };
  practical: {
    dateTime: string;
    includes: string;
    bring: string;
  };
  final: {
    heading: string;
    cta: string;
    plantingPrompt: string;
    plantingCta: string;
  };
  success: {
    title: string;
    heading: string;
    body: string;
    emailNote: string;
    noEmail: string;
    whatsappCta: string;
    backLink: string;
  };
  failure: {
    title: string;
    heading: string;
    body: string;
    backLink: string;
  };
}

export interface PlantActivityItem {
  icon: string;
  title: string;
  description: string;
}

export interface PlantFaqItem {
  q: string;
  a: string;
}

export interface PlantDict {
  meta: { title: string; description: string; ogDescription: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tag: string;
    cta: string;
    seatsLabel: string;
    seatsFullLabel: string;
    welcomeBack: string;
  };
  ritual: {
    title: string;
    titleLine2: string;
    body: string;
  };
  activitiesHeading: string;
  activities: PlantActivityItem[];
  unArbol: {
    heading: string;
    body: string;
    partnerLabel: string;
  };
  logistics: {
    heading: string;
    items: string[];
    faqHeading: string;
    faq: PlantFaqItem[];
  };
  messagesHeading: string;
  registration: {
    heading: string;
    subtitle: string;
    subtitleFull: string;
    helper: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    phoneHelper: string;
    nameError: string;
    emailError: string;
    phoneError: string;
    groupLabel: string;
    groupSolo: string;
    groupWithSomeone: string;
    groupGroup: string;
    carpoolLabel: string;
    messageLabel: string;
    messagePlaceholder: string;
    cta: string;
    submitting: string;
    successHeading: string;
    successMessage: string;
    alreadyRegistered: string;
    errorMessage: string;
    shareButton: string;
    shareDownload: string;
    sharePrompt: string;
    waitlistHeading: string;
    waitlistSubtitle: string;
    waitlistCta: string;
    waitlistSuccess: string;
  };
  finalCta: {
    title: string;
    subtitle: string;
    cta: string;
  };
}

export interface BroteUnArbolDict {
  headline: string;
  message: string[];
  includes: string[];
  pricingTitle: string;
  pricing: { label: string; price: string; highlight?: boolean }[];
  codePlaceholder: string;
  codeButton: string;
  codeInvalid: string;
  codeUsed: string;
  cta: string;
  loading: string;
  backLink: string;
}

export interface SinergiaDict {
  meta: { title: string; description: string; ogDescription: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    seatsLabel: string;
    seatsFullLabel: string;
  };
  what: {
    heading: string;
    intro: string;
    schedule: Array<{ time: string; title: string; description: string }>;
  };
  hosts: {
    heading: string;
    hari: { name: string; role: string };
    coni: { name: string; role: string };
    closing: string;
  };
  frictions: {
    heading: string;
    items: Array<{ title: string; description: string }>;
  };
  rsvp: {
    heading: string;
    subtitle: string;
    subtitleFull: string;
    /** Banner shown at the top of the form when the user lands with a
     * capacity-bypass invite link and the event is already full. */
    subtitleOverride: string;
    helper: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    phoneHelper: string;
    nameError: string;
    emailError: string;
    phoneError: string;
    dinnerError: string;
    dinnerLabel: string;
    dinnerYes: string;
    dinnerNo: string;
    cta: string;
    submitting: string;
    successHeading: string;
    successMessage: string;
    alreadyRegistered: string;
    errorMessage: string;
    micro: string;
  };
  final: {
    heading: string;
    subtitle: string;
    cta: string;
  };
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
  brote: BroteDict;
  broteUnArbol: BroteUnArbolDict;
  broteCima: BroteUnArbolDict;
  plant: PlantDict;
  sinergia: SinergiaDict;
}
