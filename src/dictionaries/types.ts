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
  photoAlt?: string;
  photoSrc?: string;
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
  cta?: { label: string; href: string };
}

export interface ImpactDict {
  heading: string;
  items: ProofPoint[];
}

export interface BeyondDict {
  heading: string;
  subheading: string;
  items: ProofPoint[];
  photoAlt: string;
}

export interface TimelineEntry {
  year: string;
  title: string;
  description: string;
  type: "life" | "work" | "community";
}

export interface BroteInfoCell {
  label: string;
  value: string;
}

/** Shared header of each numbered line-up block: "01 ····· 19:00 · Llegada". */
interface BroteLineupBlock {
  number: string;
  time: string;
  title: string;
}

export interface BroteIncludesItem {
  number: string;
  title: string;
  body: string;
}

/** Optional post-payment contact step on /brote/success. */
export interface BroteSuccessContactDict {
  heading: string;
  intro: string;
  optionalNote: string;
  nameLabel: string;
  emailLabel: string;
  emailHelper: string;
  phoneLabel: string;
  phonePlaceholder: string;
  phoneHelper: string;
  submit: string;
  submitting: string;
  /** Contact saved AND the ticket was resent to the new address. */
  doneApplied: string;
  /** Contact saved, but nothing was resent — don't promise mail. */
  doneSaved: string;
  /** Contact parked; the ticket goes out when the payment clears. */
  donePending: string;
  errors: {
    nameRequired: string;
    emailInvalid: string;
    phoneInvalid: string;
    emailTaken: string;
    generic: string;
  };
}

/**
 * Per-collaborator invitation landing. Everything here is identical across
 * the five versions except `collaborators`, which carries the two lines that
 * say why *this* person is the one inviting you.
 *
 * Names and Instagram handles deliberately live in
 * `src/lib/brote-invitations.ts`, not here: they are identity, not copy, and
 * translating them would be wrong.
 */
export interface BroteInvitacionDict {
  meta: { title: string; description: string };
  rule: { left: string; right: string };
  kicker: string;
  about: {
    wordmark: string;
    paragraphs: [string, string];
    facts: { label: string; value: string }[];
  };
  price: {
    invitedLabel: string;
    ticketLabel: string;
    discountBadge: string;
    earlyBirdBadge: string;
    noteDiscount: string;
    noteEarlyBird: string;
    noteRegular: string;
    cta: string;
    paymentMethods: string;
    loading: string;
    error: string;
  };
  includes: {
    eyebrow: string;
    items: { title: string; description: string }[];
  };
  closing: { heading: string };
  footer: { left: string; right: string };
  collaborators: Record<string, { roleLine: string; closingLine: string }>;
}

export interface BroteDict {
  meta: { title: string; description: string; ogDescription: string };
  topbar: { left: string; right: string };
  hero: {
    cta: string;
    textureAlt: string;
  };
  infoBar: {
    date: BroteInfoCell;
    time: BroteInfoCell;
    place: BroteInfoCell;
  };
  eyebrows: {
    lineup: string;
    pricing: string;
  };
  /**
   * Three blocks of deliberately unequal weight — the width and alignment of
   * each carries the hierarchy, so they are named rather than an array.
   */
  lineup: {
    timeRange: string;
    welcome: BroteLineupBlock & { kicker: string; body1: string; body2: string };
    live: BroteLineupBlock & { body: string };
    dj: BroteLineupBlock & {
      bodyBefore: string;
      bodyAfter: string;
      /** `name` is the inline link text, `label` the @handle on the tag. */
      link: { url: string; name: string; label: string };
    };
  };
  impact: {
    counterLabel: string;
  };
  pricing: {
    earlyBirdLabel: string;
    earlyBirdBadge: string;
    earlyBirdExpired: string;
    earlyBirdUntil: string;
    earlyBirdClosed: string;
    /** Carries a {savings} token, filled from the configured prices. */
    savingsLine: string;
    includesLink: string;
    /** Carries a {price} token. */
    generalNote: string;
    payment: string;
  };
  includes: {
    eyebrow: string;
    items: BroteIncludesItem[];
    featured: BroteIncludesItem;
  };
  community: {
    intro: { before: string; sponsors: string; after: string };
    body: string;
    tagline: string;
  };
  final: {
    heading: string;
    compactDate: string;
    compactTime: string;
    address: string;
    cta: string;
    plantingPrompt: string;
    plantingCta: string;
  };
  footer: { left: string; right: string };
  /** Shown under the CTA when creating the MercadoPago preference fails. */
  checkoutError: string;
  success: {
    title: string;
    heading: string;
    body: string;
    emailNote: string;
    noEmail: string;
    whatsappCta: string;
    backLink: string;
    contact: BroteSuccessContactDict;
    /** Cash / offline payments land on the success page in this state. */
    pending: { heading: string; body: string; emailNote: string };
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
    /** CTA copy when an amount is selected. `{amount}` is replaced
     * client-side with the formatted peso amount. */
    ctaWithDonation: string;
    submitting: string;
    successHeading: string;
    successMessage: string;
    alreadyRegistered: string;
    errorMessage: string;
    micro: string;
    donation: {
      heading: string;
      subtitle: string;
      /** Display labels for the three preset chips. */
      chip5k: string;
      chip10k: string;
      chip20k: string;
      customChip: string;
      customPlaceholder: string;
      declineCheckbox: string;
      /** Shown when submit is attempted but no donation choice was made. */
      chooseError: string;
      /** Shown when the custom amount is below the minimum. */
      minAmountError: string;
    };
  };
  /** Post-payment landing pages. */
  successPage: {
    title: string;
    /** Script-font decorative word over the heading ("Gracias" / "Thank you"). */
    eyebrow: string;
    heading: string;
    body: string;
    sessionLine: string;
    addressLine: string;
    whatsappCta: string;
    backLink: string;
  };
  failurePage: {
    title: string;
    heading: string;
    body: string;
    rsvpStillConfirmed: string;
    retryCta: string;
    whatsappCta: string;
    backLink: string;
  };
  final: {
    heading: string;
    subtitle: string;
    cta: string;
  };
}

export interface SinergiaParrafoDict {
  meta: { title: string; description: string; ogDescription: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    dateLine: string;
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
    sinergia: { name: string; role: string };
    parrafo: { name: string; role: string };
    closing: string;
  };
  practical: {
    heading: string;
    items: Array<{ title: string; description: string }>;
  };
  rsvp: {
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
    /** CTA copy with `{amount}` placeholder for the ticket price. */
    cta: string;
    submitting: string;
    redirecting: string;
    errorMessage: string;
    priceLine: string;
  };
  successPage: {
    title: string;
    eyebrow: string;
    heading: string;
    body: string;
    sessionLine: string;
    addressLine: string;
    emailNote: string;
    whatsappCta: string;
    backLink: string;
  };
  failurePage: {
    title: string;
    heading: string;
    body: string;
    retryCta: string;
    whatsappCta: string;
    backLink: string;
  };
  final: {
    heading: string;
    subtitle: string;
    cta: string;
  };
}

export interface MentoriaDict {
  meta: {
    title: string;
    description: string;
    ogDescription: string;
  };
  hero: {
    eyebrow: string;
    heading: string;
    intro: string;
  };
  sections: {
    forWho: MentoriaSection;
    what: MentoriaSection;
    how: MentoriaSection;
    whyMe: MentoriaSection;
  };
  /** Mentee's words — the value proposition in the client's voice.
   *  [0] renders under the hero, [1] inside the CTA section.
   *  `name` and `role` are split so the attribution can render in two
   *  weights (named person / context) without parsing the string. */
  testimonials: { text: string; name: string; role?: string }[];
  practical: {
    heading: string;
    items: { label: string; value: string }[];
    note: string;
  };
  cta: {
    heading: string;
    body: string;
    buttonLabel: string;
    href: string;
  };
}

export interface MentoriaSection {
  heading: string;
  paragraphs: string[];
  /** Pull quote shown after the section — Hari's own words. */
  quote?: string;
  /** Alt text for the section's photo. Only the sections that carry one
   *  (how, whyMe) set it; its absence is what hides the image slot. */
  imageAlt?: string;
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
    impact: string;
    values: string;
    now: string;
    story: string;
    contact: string;
    toggleMenu: string;
  };
  hero: {
    name: string;
    tagline: string;
    positioning: string;
    ctaLabel: string;
    scrollCta: string;
    photoAlt: string;
    metaRole: string;
    metaLocation: string;
    photoCaption: string;
  };
  impact: ImpactDict;
  values: ValueData[];
  beyond: BeyondDict;
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
    copyEmail: string;
    copiedEmail: string;
  };
  footer: {
    copyright: string;
    buildLine: string;
  };
  brote: BroteDict;
  broteInvitacion: BroteInvitacionDict;
  broteUnArbol: BroteUnArbolDict;
  broteCima: BroteUnArbolDict;
  plant: PlantDict;
  sinergia: SinergiaDict;
  sinergiaParrafo: SinergiaParrafoDict;
  mentoria: MentoriaDict;
}
