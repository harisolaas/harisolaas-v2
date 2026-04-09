import type { Dictionary } from "./types";

const en: Dictionary = {
  metadata: {
    title: "Harald Solaas \u2014 Technology that serves people",
    description:
      "Senior Software Engineer & Technology Consultant. From AI solutions to full-stack products, I build technology that serves people \u2014 and communities that outlive me.",
    keywords: [
      "Harald Solaas",
      "Hari Solaas",
      "Senior Software Engineer",
      "Technology Consultant",
      "AI Solutions",
      "AI Consultant",
      "React",
      "Next.js",
      "Full Stack Developer",
    ],
    ogTitle: "Harald Solaas \u2014 Technology that serves people",
    ogDescription:
      "Senior Software Engineer & Technology Consultant. From AI solutions to full-stack products, building technology that serves people and communities that outlive me.",
    twitterTitle: "Harald Solaas \u2014 Technology that serves people",
    twitterDescription:
      "Senior Software Engineer & Technology Consultant. Building technology that serves people.",
  },
  nav: {
    brand: "Hari",
    values: "Values",
    now: "Now",
    story: "Story",
    contact: "Contact",
    toggleMenu: "Toggle menu",
  },
  hero: {
    name: "Harald Solaas",
    tagline:
      "I started meditating at 15, teaching at 16, and writing code at 20. I haven\u2019t stopped doing any of them.",
    scrollCta: "Scroll to meet me",
    photoAlt: "Harald Solaas",
  },
  values: [
    {
      id: "outlive",
      statement: "I build things that outlive me.",
      proofPoints: [
        {
          label: "Community",
          title: "50 volunteers, 500+ lives touched",
          description:
            "Led 50 volunteers as part of a team to teach 500+ people in a Buenos Aires slum. Built the volunteer infrastructure, then stepped away. The program continues to this day without him.",
        },
        {
          label: "Personal",
          title: "A basketball team from nothing",
          description:
            "Created a basketball team at age 29 because he was too old to join one. Built it from nothing, played for two years, then left due to injury. The team kept playing for two more years.",
        },
        {
          label: "Professional",
          title: "From 14 prod crashes to near-zero",
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
            "At 15, became the youngest Art of Living trauma relief teacher in Latin America. Worked with people who lost homes in Villa La Angostura. Worked with orphans, rehab youth, and past criminals. Learned that behind every difficult exterior, there\u2019s a story and there\u2019s love.",
        },
        {
          label: "Professional",
          title: "The bridge between engineering and people",
          description:
            "At Carewell, rebuilt a healthcare platform so exhausted family caregivers could find what they need faster. At Est\u00e9e Lauder, a React component library serving 200+ ecommerce sites wasn\u2019t about code \u2014 it was about the person trying to buy a product. At every company, ended up as the bridge between engineering and product \u2014 because he sees the humans, not just the code.",
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
            "I was a key member of a team of four engineers that rebuilt a $21M healthcare ecommerce platform using React, Next.js, Tailwind CSS, and GraphQL. The site loads instantly, works without JavaScript, and achieves exceptional SEO scores. It launched on time, with increased engagement and sales.",
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
            "Built gamification for the Art of Living Foundation's streaming platform with thousands of monthly users, deepening engagement with meditation and wellbeing content.",
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
          title: "9 years of daily practice",
          description:
            "9 years of daily Sudarshan Kriya breathing practice and meditation. Joy isn\u2019t accidental \u2014 it\u2019s a discipline.",
        },
      ],
      quote: {
        text: "Having fun while we do the things that need to be done. Celebrating our victories, learning from our defeats and keeping our chin up.",
      },
      photoAlt: "Surfing, basketball, or Art of Living community",
      photoSrc: "/basketball.jpg",
      variant: "tan",
    },
  ],
  now: {
    heading: "What I\u2019m Building Right Now",
    subheading:
      "I\u2019m always building something \u2014 in code, in community, or in myself. Here\u2019s what I\u2019m working on these days.",
    items: [
      {
        categoryKey: "teaching",
        categoryLabel: "Teaching",
        title: "Art of Living Workshops",
        description:
          "Next dates for meditation and breathing technique courses. Learn Sudarshan Kriya and tools for managing stress, anxiety, and emotional wellbeing.",
        status: "Upcoming",
        cta: {
          label: "See Upcoming Dates",
          href: "https://wa.me/5491122555110?text=Hi%20I%27d%20like%20information%20about%20the%20meditation%20workshops",
        },
      },
      {
        categoryKey: "building",
        categoryLabel: "Building",
        title: "Technology & AI Partner for Businesses",
        description:
          "Helping businesses bring their operations into the digital world \u2014 from AI-powered automation and intelligent workflows to full product builds. If you need a technology partner who understands both the tech and the business, let\u2019s talk.",
        status: "Ongoing",
        cta: { label: "Get in Touch", href: "mailto:dev@harisolaas.com" },
      },
      {
        categoryKey: "building",
        categoryLabel: "Building",
        title: "AI Solutions That Serve People",
        description:
          "Building AI-powered tools that genuinely help \u2014 not replace \u2014 the people who use them. From intelligent automation to custom AI integrations, always with the human at the center.",
        status: "Ongoing",
        cta: { label: "Get in Touch", href: "mailto:dev@harisolaas.com" },
      },
      {
        categoryKey: "personal",
        categoryLabel: "Personal",
        title: "Follow My Adventures",
        description:
          "Keeping adventure, art, travel and physical challenges as part of my everyday life. Follow along on Instagram.",
        status: "In Progress",
        cta: {
          label: "Follow on Instagram",
          href: "https://instagram.com/harisolaas",
        },
      },
      {
        categoryKey: "community",
        categoryLabel: "Community",
        title: "BROTE \u2014 Reforestation party",
        description:
          "Live music, specialty coffee, DJ set, and an afternoon with purpose. Each ticket plants a real tree in Argentina. Saturday March 28, Palermo.",
        status: "March 28",
        cta: {
          label: "Get my ticket",
          href: "/en/brote",
        },
      },
      {
        categoryKey: "teaching",
        categoryLabel: "Teaching",
        title: "Breathwork & Leadership for Youth",
        description:
          "Ongoing programs with university students and young professionals, combining breathwork, meditation, and practical tools for emotional strength, purpose, and conscious leadership.",
        status: "Ongoing",
        cta: {
          label: "Volunteer",
          href: "https://wa.me/5491122555110?text=Hi%20I%27d%20like%20information%20about%20the%20meditation%20courses",
        },
      },
    ],
  },
  timeline: {
    heading: "The Full Story",
    subheading: "A compact arc from age 15 to now.",
    expand: "Expand Timeline",
    collapse: "Collapse Timeline",
    techHeading: "Technologies",
    entries: [
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
          "Post-disaster community support \u2014 working with people who lost their homes.",
        type: "community",
      },
      {
        year: "2011\u20132012",
        title: "Service",
        description:
          "Ense\u00f1ar t\u00e9cnicas de manejo emocional a orphans, at-risk youth, and past criminals.",
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
          "Building and scaling real-world systems for organizations in health, legal services, and public-facing institutions. From complex claim platforms and verification flows to internal tools and production-grade frontends. Where engineering became ownership, judgment, and long-term responsibility. The beginning of a lifelong craft.",
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
        description:
          "Reconnecting with heritage and rebuilding family bridges.",
        type: "life",
      },
      {
        year: "2023\u2013Present",
        title: "Senior Consultant",
        description:
          "Carewell ($21M healthcare ecommerce rebuild), Colgate (technology advisor), AI-powered solutions, various clients. Evolution from engineer to trusted advisor.",
        type: "work",
      },
    ],
    technologies: [
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
      "OpenAI API",
      "LangChain",
      "AI Automation",
    ],
  },
  contact: {
    heading: "Let\u2019s build something.",
    description:
      "I work as a senior technology consultant \u2014 helping companies build the right products with the right technologies, including AI solutions that genuinely serve your team and your users. I bring deep engineering expertise, human communication, and a service-oriented mindset. If you want an engineer who cares about your problem as much as you do, let\u2019s talk.",
    caseStudyLabel: "Read the Carewell Case Study on Toptal",
    linkLabels: {
      email: "Email",
      linkedin: "LinkedIn",
      toptal: "Toptal",
      instagram: "Instagram",
    },
  },
  footer: {
    copyright: "Harald Solaas \u2014 harisolaas.com",
  },
  brote: {
    meta: {
      title: "BROTE \u2014 Reforestation party",
      description:
        "Live music, specialty coffee, DJ set, and an afternoon with purpose. Every ticket plants a real tree in Argentina. Saturday March 28.",
      ogDescription:
        "Live music, specialty coffee, DJ set, and an afternoon with purpose. Every ticket plants a real tree in Argentina.",
    },
    hero: {
      subtitle: "Reforestation party",
      dateTime: "Saturday March 28 \u00b7 2 to 7 PM \u00b7 Argentina",
      subhead:
        "Live music, specialty coffee, DJ set, and a full afternoon with people who celebrate with purpose. Every ticket plants a real tree in Argentina.",
      cta: "I want my ticket",
    },
    experience: [
      {
        icon: "\u2615",
        title: "Specialty coffee & pastries",
        description:
          "A curated coffee stand to kick off the afternoon with your senses wide open.",
      },
      {
        icon: "\ud83c\udfb5",
        title: "Live music + DJ set",
        description:
          "Opening with live acoustic music and a DJ to close. From calm to dance, all in one afternoon.",
      },
      {
        icon: "\ud83e\uddd8",
        title: "Group meditation + intention for nature",
        description:
          "Close the afternoon connecting with yourself and nature. A guided experience to take something home that lasts longer than the music.",
      },
      {
        icon: "\ud83c\udf31",
        title: "1 ticket = 1 tree",
        description:
          "Each ticket plants a real tree in Argentina with Un \u00c1rbol, an NGO with over 15 years and thousands of trees planted across the country.",
      },
    ],
    lineup: {
      toggle: "See the lineup",
      items: [
        {
          time: "15:00",
          title: "Opening",
          description:
            "Coffee, pastries, and meeting people. A moment to arrive, get comfortable and settle in before everything starts.",
          link: { url: "https://www.instagram.com/nuezabsas/", label: "Nueza" },
        },
        {
          time: "15:30",
          title: "Ximena live",
          description: "Acoustic music to set the mood.",
          link: { url: "https://www.instagram.com/ximenasmusica/", label: "Ximena" },
        },
        {
          time: "16:00",
          title: "Un \u00c1rbol",
          description:
            "Talk about reforestation and collective planting. Everyone makes their own native plant sprout and takes it home. Followed by an intention planting: a brief collective meditation to close the moment.",
          link: { url: "https://www.instagram.com/unarbol_ong/", label: "Un \u00c1rbol" },
        },
        {
          time: "17:00",
          title: "DJ set",
          description: "Dancing until the end.",
        },
      ],
    },
    impact: {
      heading: "Your ticket doesn\u2019t get spent. It gets planted.",
      partner: {
        intro: "We work with ",
        name: "Un \u00c1rbol",
        rest: ", a civil association with over 15 years dedicated to reforesting areas across Argentina. We\u2019ve already done a planting trip with them and saw firsthand how they work.",
      },
      body: "Each ticket funds the planting of a native tree. It\u2019s not symbolic: it\u2019s a real tree, in a real place, that will keep growing long after the music stops.",
      attendees:
        "If {count} people come, that\u2019s {count} trees. Simple as that.",
      partnerLabel: "In partnership with",
    },
    pricing: {
      reanchor:
        "An afternoon of music, coffee, community, and a tree planted in your name.",
      cta: "I want my ticket",
      payment: "Pay with MercadoPago / card / bank transfer.",
      earlyBirdBadge: "Early bird — 20% OFF",
      earlyBirdUntil: "Until March 16",
    },
    about: {
      intro: {
        before: "This comes from ",
        sponsors: "Sky Campus and The Art of Living",
        after:
          ", communities practicing breathwork, yoga, and service across 100+ universities and 180 countries worldwide.",
      },
      body: "We don\u2019t organize events. We create experiences where what you do on the outside reflects what you cultivate within.",
      closing: "This party is open to everyone. Come as you are.",
    },
    practical: {
      dateTime: "Saturday March 28 \u00b7 2:00 to 7:00 PM",
      includes:
        "Your ticket includes: music, coffee, activities, and planting 1 tree",
      bring: "Come in cool and comfy clothes and good vibes",
    },
    final: {
      heading: "Are you coming?",
      cta: "I want my ticket",
      plantingPrompt: "Can\u2019t make it but want to be part of it?",
      plantingCta: "Join the planting",
    },
    success: {
      title: "BROTE \u2014 You\u2019re in!",
      heading: "You\u2019re part of the forest now!",
      body: "Because of you, a new tree will take root in Argentina. That\u2019s real, and it\u2019s because of what you chose to do today. See you on March 28 to celebrate together.",
      emailNote: "Your ticket with the QR code will arrive at the email you used in MercadoPago in the next few minutes. Check your inbox and spam.",
      noEmail: "Didn\u2019t get the email? Reach out and we\u2019ll sort it out.",
      whatsappCta: "Message me on WhatsApp",
      backLink: "Back to BROTE",
    },
    failure: {
      title: "BROTE \u2014 Payment not completed",
      heading: "Payment didn\u2019t go through",
      body: "Something went wrong with the payment or it was cancelled. You can try again from the BROTE page.",
      backLink: "Back to BROTE",
    },
  },
  broteUnArbol: {
    headline: "A party. A tree. Your afternoon.",
    message: [
      "This party is born from the same logic shared at Un \u00c1rbol: real impact starts with concrete action.",
      "For the Un \u00c1rbol community: $17,477 ARS \u2014 25% OFF the final price.",
      "Each ticket plants a native tree in the Buenos Aires metro area.",
    ],
    includes: [
      "Specialty coffee & pastries (Nueza)",
      "Live music (Ximena) + DJ set (Gaspar Insfr\u00e1n from Paraguay)",
      "Reforestation talk + collective planting \u2014 take your plant home",
      "Intention planting (collective meditation)",
    ],
    pricingTitle: "Pricing",
    pricing: [
      { label: "Un \u00c1rbol community (25% OFF)", price: "$17,477", highlight: true },
      { label: "General presale", price: "$18,650" },
      { label: "At the door", price: "$23,303" },
    ],
    codePlaceholder: "Enter your code",
    codeButton: "Validate",
    codeInvalid: "Invalid code. Check that it\u2019s correct.",
    codeUsed: "This code has already been used.",
    cta: "Get my ticket",
    loading: "Processing...",
    backLink: "Back to BROTE",
  },
  broteCima: {
    headline: "Run with CIMA. Plant with BROTE.",
    message: [
      "The CIMA community knows what it means to move with purpose. This time, every step plants a tree.",
      "For the CIMA community: $17,477 ARS — 25% OFF the final price.",
      "Each ticket plants a native tree in the Buenos Aires metro area.",
    ],
    includes: [
      "Specialty coffee & pastries (Nueza)",
      "Live music (Ximena) + DJ set (Gaspar Insfrán from Paraguay)",
      "Reforestation talk + collective planting — take your plant home",
      "Intention planting (collective meditation)",
    ],
    pricingTitle: "Pricing",
    pricing: [
      { label: "CIMA community (25% OFF)", price: "$17,477", highlight: true },
      { label: "General presale", price: "$18,650" },
      { label: "At the door", price: "$23,303" },
    ],
    codePlaceholder: "Enter your code",
    codeButton: "Validate",
    codeInvalid: "Invalid code. Check that it\u2019s correct.",
    codeUsed: "This code has already been used.",
    cta: "Get my ticket",
    loading: "Processing...",
    backLink: "Back to BROTE",
  },
  plant: {
    meta: {
      title: "BROTE — The Second Movement",
      description: "On April 19 we close the BROTE ritual: meditation, planting with Un Árbol, and a relaxed afternoon at a nature reserve near Buenos Aires. Free, 40 spots, registration required.",
      ogDescription: "BROTE\u2019s second movement. Sunday April 19 at a nature reserve in San Miguel. Free, limited spots.",
    },
    hero: {
      eyebrow: "SUNDAY APRIL 19 · FROM 2:30 PM · SAN MIGUEL",
      title: "BROTE\u2019s second movement.",
      subtitle: "The party planted trees on a spreadsheet. On April 19 we meet to get our hands in the dirt with Un Árbol.",
      tag: "Free · 40 spots · Register to get the address",
      cta: "Save your shovel 🌱",
      seatsLabel: "{remaining} of 40 spots left",
      seatsFullLabel: "All 40 spots are taken",
      welcomeBack: "You were at BROTE! Great to see you again 🌱",
    },
    ritual: {
      title: "The ones who came to BROTE planted with their wallets.",
      titleLine2: "The ones who come on April 19 plant with their hands.",
      body: "On March 28, 80 of us gathered at a party that financed native tree planting with Un Árbol. That was the first movement. Now we head to the reserve to get our hands in the soil, share an afternoon, and close the loop. This isn\u2019t volunteering. It\u2019s giving something back to a piece of the country that doesn\u2019t have it today.",
    },
    activitiesHeading: "What\u2019s going to happen that afternoon",
    activities: [
      {
        icon: "🌱",
        title: "Hands in the soil",
        description: "You\u2019ll dig, settle the roots, press the earth and leave a native tree standing. It\u2019s not all-day labor — it\u2019s a short moment done right, with people who know.",
      },
      {
        icon: "🧘",
        title: "Guided meditation",
        description: "Before planting, a quiet moment sitting in silence. To arrive well, lower the city noise, and show up whole before the earth.",
      },
      {
        icon: "🌮",
        title: "Food trucks and hangout",
        description: "There are food trucks on the reserve, mellow music, and room to stay. You come to plant, but also to enjoy a Sunday afternoon.",
      },
      {
        icon: "🌿",
        title: "Un Árbol tells you",
        description: "The NGO that\u2019s been restoring native forests for 15 years. You\u2019ll learn about their work firsthand and understand where the trees we don\u2019t plant that day go — Un Árbol keeps planting them all around the country.",
      },
    ],
    unArbol: {
      heading: "Un Árbol",
      body: "Un Árbol has been restoring native forests in Argentina for over 15 years. They\u2019re the ones who turned the March 28 party into real trees, and they\u2019re the ones who decide where and when to plant them across the country. On April 19 they welcome us to the reserve to plant a portion together; the rest they keep planting on their own schedule. You bring the hands. They bring 15 years of knowing where, how, and what.",
      partnerLabel: "IN PARTNERSHIP WITH",
    },
    logistics: {
      heading: "What you need to know",
      items: [
        "Nature reserve in the San Miguel / Bella Vista area (~1h from Capital via Acceso Norte)",
        "The exact address and Google Maps link are sent by email when you register",
        "San Martín train to Bella Vista + short ride",
        "We organize carpools from Capital — check it in the form",
      ],
      faqHeading: "Frequently asked",
      faq: [
        {
          q: "Is it free?",
          a: "Yes, completely free. But you need to register — there are 40 spots and we only send the exact address by email to people on the list.",
        },
        {
          q: "What should I bring?",
          a: "Clothes you don\u2019t mind getting dirty, closed shoes, a hat, water. Garden gloves if you have them.",
        },
        {
          q: "How many trees will we plant that day?",
          a: "A symbolic portion, done with time and attention. The rest Un Árbol plants across the country whenever and wherever it makes sense — that\u2019s their work and they do it better than anyone.",
        },
        {
          q: "Is there food?",
          a: "Yes, there are food trucks on the reserve. Bring cash or card if you want to eat.",
        },
        {
          q: "What if it rains?",
          a: "If the forecast is bad, we reschedule and email you at least 24h in advance. That\u2019s why being registered matters.",
        },
        {
          q: "Can I bring my kid?",
          a: "Yes, from age 8 and up. Kids plant better than we do. Register them as \"with someone\" in the form.",
        },
        {
          q: "How long does it last?",
          a: "We start at 2:30 PM and the reserve stays open until 7. You can leave earlier if you want — it\u2019s not a work shift, it\u2019s a Sunday afternoon. We plant, we meditate, we eat, we hang out.",
        },
        {
          q: "Restrooms and water?",
          a: "Yes, at the reserve.",
        },
      ],
    },
    registration: {
      heading: "Sign up to plant",
      subtitle: "Free, but limited. {remaining} of 40 spots left.",
      subtitleFull: "All 40 spots are taken. Drop your email for the waitlist.",
      helper: "Leave us your name and email. We\u2019ll send the exact address, the schedule, and everything you need to know.",
      namePlaceholder: "Your name",
      emailPlaceholder: "Your email",
      groupLabel: "Are you coming alone or with someone?",
      groupSolo: "Alone",
      groupWithSomeone: "With someone",
      groupGroup: "With a group (3+)",
      carpoolLabel: "I can offer a ride in my car from Capital",
      messageLabel: "Leave a message to nudge the next person to sign up (optional)",
      messagePlaceholder: "E.g.: Come plant with me, it\u2019s free and it\u2019s going to be beautiful 🌱",
      cta: "I\u2019m in for April 19 🌱",
      submitting: "Booking...",
      successHeading: "You\u2019re in.",
      successMessage: "We sent you the exact address and details by email. See you on the 19th with your hands ready.",
      alreadyRegistered: "You were already on the list. Check your email for the details.",
      errorMessage: "Something went wrong. Please try again.",
      shareButton: "Share to stories",
      shareDownload: "Download image",
      sharePrompt: "Drop it on your story and let\u2019s keep the buzz going 🌱",
      waitlistHeading: "Waitlist",
      waitlistSubtitle: "All 40 spots are taken. Drop your email and we\u2019ll let you know if one opens up.",
      waitlistCta: "Add me to the waitlist",
      waitlistSuccess: "Done. We\u2019ll let you know if a spot opens up.",
    },
    finalCta: {
      title: "40 spots. One afternoon at the reserve.",
      subtitle: "Free. But you need to be on the list to get in.",
      cta: "Save your shovel 🌱",
    },
  },
};

export default en;
