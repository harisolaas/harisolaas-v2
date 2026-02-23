export interface SocialLink {
  label: string;
  href: string;
  external?: boolean;
}

export const socialLinks: SocialLink[] = [
  { label: "Email", href: "mailto:hello@harisolaas.com" },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/haraldsolaas",
    external: true,
  },
  {
    label: "Toptal",
    href: "https://www.toptal.com/resume/harald-solaas",
    external: true,
  },
  { label: "Instagram", href: "https://instagram.com", external: true },
];

export const caseStudyLink =
  "https://www.toptal.com/case-study/healthcare-supply-modernizes-ecommerce-platform";
