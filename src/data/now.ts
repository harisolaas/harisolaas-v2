export type NowCategory = "Teaching" | "Building" | "Community" | "Personal";

export interface NowItem {
  category: NowCategory;
  title: string;
  description: string;
  status: string;
  cta: { label: string; href: string };
}

export const categoryColors: Record<NowCategory, { bg: string; text: string }> =
  {
    Teaching: { bg: "bg-sage/20", text: "text-forest" },
    Building: { bg: "bg-terracotta/20", text: "text-terracotta" },
    Community: { bg: "bg-forest/20", text: "text-forest" },
    Personal: { bg: "bg-tan/40", text: "text-charcoal" },
  };

export const nowItems: NowItem[] = [
  {
    category: "Teaching",
    title: "Art of Living Workshops",
    description:
      "Next dates for meditation and breathing technique courses. Learn Sudarshan Kriya and tools for managing stress, anxiety, and emotional wellbeing.",
    status: "Upcoming",
    cta: { label: "See Upcoming Dates", href: "#contact" },
  },
  {
    category: "Building",
    title: "Technology Partner for Local Businesses",
    description:
      "Currently helping Argentine businesses bring their operations into the digital world \u2014 from automation to full product builds. If you need a technology partner who understands both the tech and the business, let\u2019s talk.",
    status: "Ongoing",
    cta: { label: "Get in Touch", href: "#contact" },
  },
  {
    category: "Community",
    title: "Tree Planting Initiative",
    description:
      "Annual birthday tradition \u2014 planting trees with the community. Building something that will outlast all of us.",
    status: "Annual",
    cta: { label: "Learn More", href: "#contact" },
  },
  {
    category: "Teaching",
    title: "Breathwork & Human Values for Youth",
    description:
      "Ongoing programs working with teenagers and young adults on meditation, emotional resilience, and finding alternatives to violence and crime.",
    status: "Ongoing",
    cta: { label: "Volunteer", href: "#contact" },
  },
  {
    category: "Personal",
    title: "Surf Season Prep",
    description:
      "Following an 8-week training program to get surf-ready and protect the knees. Follow along on Instagram.",
    status: "In Progress",
    cta: { label: "Follow on Instagram", href: "https://instagram.com" },
  },
];
