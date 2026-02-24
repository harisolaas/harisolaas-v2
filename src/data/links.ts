export interface SocialLink {
  key: string;
  href: string;
  external?: boolean;
}

export const socialLinks: SocialLink[] = [
  { key: "email", href: "mailto:hello@harisolaas.com" },
  {
    key: "linkedin",
    href: "https://linkedin.com/in/haraldsolaas",
    external: true,
  },
  {
    key: "toptal",
    href: "https://www.toptal.com/resume/harald-solaas",
    external: true,
  },
  { key: "instagram", href: "https://instagram.com", external: true },
];

export const caseStudyLink =
  "https://www.toptal.com/case-study/healthcare-supply-modernizes-ecommerce-platform";
