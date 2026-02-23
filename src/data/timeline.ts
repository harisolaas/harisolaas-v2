export interface TimelineEntry {
  year: string;
  title: string;
  description: string;
  type: "life" | "work" | "community";
}

export const timelineEntries: TimelineEntry[] = [
  {
    year: "2009",
    title: "Art of Living \u2014 Age 15",
    description:
      "Began meditation practice and training as a trauma relief teacher. Youngest Art of Living teacher in Latin America.",
    type: "life",
  },
  {
    year: "2011\u20132012",
    title: "Villa La Angostura",
    description:
      "Post-disaster community support \u2014 working with people who lost their homes, orphans, at-risk youth, and past criminals.",
    type: "community",
  },
  {
    year: "2014\u20132017",
    title: "University of Belgrano",
    description:
      "BSc in Business Management. Started programming at 20 out of necessity for entrepreneurship contests.",
    type: "life",
  },
  {
    year: "2016\u2013Present",
    title: "Independent Software Engineer",
    description:
      "Freelance work \u2014 artist portfolios, foundation sites, ecommerce platforms. The beginning of a lifelong craft.",
    type: "work",
  },
  {
    year: "2016\u20132022",
    title: "Community Service",
    description:
      "Slum programs with 50 volunteers and 500+ participants. 3-year soccer club youth program. Volunteer team building.",
    type: "community",
  },
  {
    year: "2018\u20132019",
    title: "GuruDevelopers",
    description:
      "Ecommerce, Art of Living streaming platform, WordPress plugins. First \u201creal\u201d software factory experience.",
    type: "work",
  },
  {
    year: "2019\u20132020",
    title: "Litebox \u2014 Technical Lead",
    description:
      "Nubi digital wallet (50K+ users), BI startup, marine apps, mobile game (50K+ downloads), personalized dog nutrition ecommerce. Mentored juniors to mid-level.",
    type: "work",
  },
  {
    year: "2020\u20132021",
    title: "The Est\u00e9e Lauder Companies",
    description:
      "Senior Frontend Engineer \u2014 React component library serving 200+ ecommerce sites. Test coverage 60%\u219285%. Global multi-tenancy at scale.",
    type: "work",
  },
  {
    year: "2021\u20132023",
    title: "Cruise via Toptal",
    description:
      "Senior Software Engineer \u2014 Autonomous vehicle analytics platform. Testing 20%\u219270%, crashes 14\u21920.3/month. D3.js data visualization. First Silicon Valley company.",
    type: "work",
  },
  {
    year: "2022",
    title: "Art of Living Teacher",
    description:
      "Became a certified teacher for core Art of Living programs. Teaching courses, building community.",
    type: "life",
  },
  {
    year: "2023",
    title: "Norway",
    description: "Reconnecting with family heritage.",
    type: "life",
  },
  {
    year: "2023\u2013Present",
    title: "Senior Consultant",
    description:
      "Carewell ($21M healthcare ecommerce rebuild), Colgate (technology advisor), various clients. Evolution from engineer to trusted advisor.",
    type: "work",
  },
];

export const technologies = [
  "React.js",
  "React Native",
  "Next.js",
  "TypeScript",
  "Node.js",
  "GraphQL",
  "D3.js",
  "Tailwind CSS",
  "Redux",
  "MobX",
  "Jest",
  "Cypress",
  "Styled Components",
  "Vue.js",
  "Express.js",
  "PHP",
  "Laravel",
  "Docker",
  "AWS",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
];
