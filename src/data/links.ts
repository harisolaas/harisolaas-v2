export interface SocialLink {
  key: string;
  href: string;
  external?: boolean;
}

export const socialLinks: SocialLink[] = [
  { key: "email", href: "mailto:dev@harisolaas.com" },
  {
    key: "linkedin",
    href: "https://www.linkedin.com/in/harisolaas/",
    external: true,
  },
  {
    key: "toptal",
    href: "https://www.toptal.com/resume/harald-solaas",
    external: true,
  },
  {
    key: "instagram",
    href: "https://instagram.com/harisolaas",
    external: true,
  },
];

export const caseStudyLink =
  "https://www.toptal.com/case-study/healthcare-supply-modernizes-ecommerce-platform";
