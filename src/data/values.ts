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

export const values: ValueData[] = [
  {
    id: "outlive",
    statement: "I build things that outlive me.",
    proofPoints: [
      {
        label: "Community",
        title: "50 volunteers, 500+ lives touched",
        description:
          "Led 50 volunteers to teach 500+ people in a Buenos Aires slum. Built the volunteer infrastructure, then stepped away. The program continued for 2+ years without him.",
      },
      {
        label: "Personal",
        title: "A basketball team from nothing",
        description:
          "Created a basketball team at age 29 because he was too old to join one. Built it from nothing, played for two years, then left due to injury. The team kept playing for two more years.",
      },
      {
        label: "Professional",
        title: "From 14 crashes to near-zero",
        description:
          "At Cruise (autonomous vehicles, Silicon Valley), inherited a codebase with 20% test coverage and 14 crashes/month. Left it at 70%+ coverage with 0.3 crashes/month. The testing infrastructure he built became the team\u2019s foundation.",
      },
    ],
    photoAlt: "Community volunteering work in Buenos Aires",
    photoSrc: "/community.jpg",
    variant: "cream",
  },
  {
    id: "humans",
    statement: "I see the humans behind the system.",
    proofPoints: [
      {
        label: "Origin",
        title: "A psychologist\u2019s son",
        description:
          "Father was a psychologist and organizational consultant. From childhood, Hari learned to see systems as collections of people \u2014 their motivations, rewards, and sense of belonging.",
      },
      {
        label: "Formative",
        title: "Youngest trauma relief teacher in Latin America",
        description:
          "At 15, became the youngest Art of Living trauma relief teacher in Latin America. Worked with people who lost homes in Villa La Angostura. Worked with orphans, at-risk youth, and past criminals. Learned that behind every difficult exterior, there\u2019s a story and there\u2019s love.",
      },
      {
        label: "Professional",
        title: "The bridge between engineering and people",
        description:
          "At Est\u00e9e Lauder, a React component library serving 200+ ecommerce sites wasn\u2019t about code \u2014 it was about the person trying to buy a product. At Carewell, rebuilt a healthcare platform so exhausted family caregivers could find what they need faster. At every company, ended up as the bridge between engineering and product \u2014 because he sees the humans, not just the code.",
      },
    ],
    photoAlt: "Working with youth in community settings",
    photoSrc: "/working-with-youth.jpg",
    variant: "tan",
  },
  {
    id: "percentile",
    statement: "I go to the last percentile.",
    proofPoints: [
      {
        label: "Cruise",
        title: "Autonomous vehicle analytics",
        description:
          "Built the analytics platform used by executives and operations staff across the company. Reduced execution time by 90% on critical components.",
        metrics: [
          { value: "20\u219270%", label: "Test coverage in 3 months" },
          { value: "14\u21920.3", label: "Crashes per month" },
          { value: "90%", label: "Execution time reduction" },
        ],
      },
      {
        label: "Carewell",
        title: "$21M healthcare platform rebuild",
        description:
          "Rebuilt a $21M healthcare ecommerce platform with React, Next.js, Tailwind CSS, and GraphQL. The site loads instantly, works without JavaScript, achieves exceptional SEO scores. Launched on time with increased engagement and sales.",
        metrics: [
          { value: "$21M", label: "Platform rebuilt" },
          { value: "100", label: "Lighthouse performance" },
        ],
      },
      {
        label: "Est\u00e9e Lauder",
        title: "200+ brand sites globally",
        description:
          "Built flexible, reusable components serving 200+ brand sites globally. Reduced time to first interaction. Multi-tenancy at the extreme \u2014 every deployment matters when hundreds of thousands of users depend on it daily.",
        metrics: [
          { value: "200+", label: "Sites served" },
          { value: "60\u219285%", label: "Test coverage" },
        ],
      },
    ],
    quote: {
      text: "Not leaving anything for later. Going to the one percentile of making the user experience awesome. Optimizing as much as it makes sense, as much as it adds value.",
    },
    photoAlt: "Technical excellence and precision",
    photoSrc: "/excellence.jpg",
    photoPosition: "80% center",
    variant: "cream",
  },
  {
    id: "serve",
    statement: "Technology should serve people, not replace them.",
    proofPoints: [
      {
        label: "Art of Living",
        title: "Streaming platform for wellbeing",
        description:
          "Built a streaming platform for the foundation with thousands of monthly users, using gamified video challenges to deepen engagement with meditation and wellbeing content.",
      },
      {
        label: "Cruise",
        title: "Tools that build the future",
        description:
          "Built tools that helped car engineers, testers, and data scientists visualize hundreds of thousands of data points from autonomous drives. Building the tools that build the future of transportation.",
      },
      {
        label: "Carewell",
        title: "Technology for vulnerable moments",
        description:
          "Making healthcare supplies accessible to families caring for aging loved ones. Technology that reduces friction in a moment of vulnerability.",
      },
      {
        label: "Nubi",
        title: "Financial access for 50,000+",
        description:
          "Gave 50,000+ Latin Americans easier access to their PayPal funds \u2014 international transfers, withdrawals, credit card management.",
      },
      {
        label: "Philosophy",
        title: "Inspired by Muhammad Yunus",
        description:
          "Inspired by the \u201cBanker to the Poor\u201d \u2014 the idea that systems (financial, technological, organizational) can be designed to serve people who have been forgotten.",
      },
    ],
    quote: {
      text: "I want to make technology your ally, your friend \u2014 not a threat.",
    },
    photoAlt: "Technology serving human needs",
    photoSrc: "/for-people.png",
    variant: "forest",
  },
  {
    id: "joy",
    statement: "I bring joy to the work.",
    proofPoints: [
      {
        label: "Basketball",
        title: "Too old to join, so he built one",
        description:
          "Too old to join a team at 29, so he created one. Joined an amateur league. It became its own living thing.",
      },
      {
        label: "Teaching",
        title: "Three years in a slum",
        description:
          "Teaching teenagers breathing techniques, human values, how to be kids again. Helping adolescents leave crime. Showing that there\u2019s another way.",
      },
      {
        label: "Art of Living",
        title: "Teacher since 2022",
        description:
          "Teaching courses, building community on social media, learning to sell with authenticity, networking, building volunteer groups rooted in ethics.",
      },
      {
        label: "Daily practice",
        title: "8\u20139 years of daily practice",
        description:
          "8\u20139 years of daily Sudarshan Kriya breathing practice. Joy isn\u2019t accidental \u2014 it\u2019s a discipline.",
      },
    ],
    quote: {
      text: "Having fun while we do the things that need to be done. Celebrating our victories, learning from our defeats and keeping our chin up.",
    },
    photoAlt: "Surfing, basketball, or Art of Living community",
    photoSrc: "/basketball.jpg",
    variant: "tan",
  },
];
