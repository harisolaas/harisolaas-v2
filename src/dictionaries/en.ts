import type { Dictionary } from "./types";

const en: Dictionary = {
  metadata: {
    title: "Harald Solaas \u2014 Technology that serves people",
    description:
      "Senior Software Engineer & Technology Consultant. A decade of measurable results \u2014 a $21M ecommerce rebuild, platforms powering 200+ global storefronts \u2014 building technology that serves people.",
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
      "Senior Software Engineer & Technology Consultant. A decade of measurable results, building technology that serves people.",
    twitterTitle: "Harald Solaas \u2014 Technology that serves people",
    twitterDescription:
      "Senior Software Engineer & Technology Consultant. Building technology that serves people.",
  },
  nav: {
    brand: "Hari",
    impact: "Results",
    values: "Values",
    now: "Now",
    story: "Experience",
    contact: "Contact",
    toggleMenu: "Toggle menu",
  },
  hero: {
    name: "Harald Solaas",
    tagline:
      "I started meditating at 15, teaching at 16, and writing code at 20. I haven\u2019t stopped doing any of them.",
    positioning:
      "I help companies build products that last — currently taking on consulting work.",
    ctaLabel: "Let’s build something",
    scrollCta: "Scroll to meet me",
    photoAlt: "Harald Solaas",
    metaRole: "Senior software engineer · Technology consultant",
    metaLocation: "Buenos Aires, Argentina",
    photoCaption: "fig. 01 — the human",
  },
  impact: {
    heading: "Results",
    items: [
      {
        label: "Carewell",
        title: "A $21M rebuild that paid off in month one",
        description:
          "Four engineers rebuilt Carewell's healthcare ecommerce from the ground up. We launched on time, engagement and sales rose in the first month, and the site works even with JavaScript turned off — a board-level requirement full of problems nobody in the industry had solved before.",
        metrics: [
          { value: "$21M", label: "Platform rebuilt" },
          { value: "100", label: "Lighthouse performance" },
        ],
      },
      {
        label: "Cruise",
        title: "From weekly firefighting to a year of calm",
        description:
          "The analytics platform executives and operations depended on crashed 14 times a month. I changed how the team tested — real use cases over coverage numbers — trained my colleagues, and it ran for a year at nearly zero. That infrastructure is still the team's foundation.",
        metrics: [
          { value: "14→0.3", label: "Crashes per month" },
          { value: "90%", label: "Less execution time" },
        ],
      },
      {
        label: "Estée Lauder",
        title: "One system, 200+ storefronts",
        description:
          "One component system powering the ecommerce of 200+ brand sites worldwide. When hundreds of thousands of people shop every day, each deploy matters — we raised test coverage from 60% to 85% and cut the time to first interaction.",
        metrics: [
          { value: "200+", label: "Sites served" },
          { value: "60→85%", label: "Test coverage" },
        ],
      },
      {
        label: "Legal industry · 2023–today",
        title: "A platform that holds when the flood comes",
        description:
          "A US legal company handling mass claims: when a case opens, traffic spikes massively within hours. I migrated their legacy single-page app to a server-rendered platform that stays fast, accessible and secure under load — and keeps their operation online.",
      },
    ],
  },
  values: [
    {
      id: "percentile",
      statement: "I go for the last 1%.",
      proofPoints: [
        {
          label: "Carewell",
          title: "An ecommerce that works without JavaScript",
          description:
            "The CDO tested the entire site with JavaScript disabled \u2014 nothing was allowed to break. Most of what that required had no documented solution, so I worked in proof-of-concepts: build small, validate with the team, incubate each feature on a corner of the site, then grow it to the whole stack.",
        },
        {
          label: "Online academy",
          title: "Done means measured",
          description:
            "On a high-traffic learning platform we deployed progressively by user tiers. A feature wasn\u2019t complete until 100% of users had run it for a week \u2014 with reliable data on its impact.",
        },
        {
          label: "AI-augmented delivery",
          title: "Three reviews before a human reads it",
          description:
            "I build my own tooling: every pull request I open gets reviewed by two AI models, merged into one review, and pruned by a third agent before I read it. The last 1% includes how the work itself gets done.",
        },
      ],
      quote: {
        text: "Not leaving anything for later. Going for the last 1% that makes the user experience awesome. Optimizing as much as it makes sense, as much as it adds value.",
      },
      photoAlt: "Technical excellence and precision",
      photoSrc: "/excellence.jpg",
      photoPosition: "80% center",
      variant: "forest",
    },
    {
      id: "outlive",
      statement: "I build things that outlive me.",
      proofPoints: [
        {
          label: "Cruise",
          title: "Testing infrastructure that became the foundation",
          description:
            "At Cruise (autonomous vehicles, Silicon Valley) I didn\u2019t just stop the crashes \u2014 I changed how the team tested and trained the engineers around me. Years later, the testing infrastructure I built is still what the team stands on.",
        },
        {
          label: "Est\u00e9e Lauder",
          title: "Components that outlived my tenure",
          description:
            "The component system I helped build keeps powering 200+ brand storefronts long after I moved on. Code that lasts is code that was thought through.",
        },
        {
          label: "Community",
          title: "A program that runs without me",
          description:
            "I led 50 volunteers as part of a team to teach 500+ people in a Buenos Aires slum. I built the volunteer infrastructure, then stepped away. The program continues to this day without me.",
        },
      ],
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
            "My father was a psychologist and organizational consultant. From childhood, I learned to see systems as collections of people \u2014 their motivations, rewards, and sense of belonging.",
        },
        {
          label: "Formative",
          title: "Youngest trauma relief teacher in Latin America",
          description:
            "At 16, I became the youngest Art of Living trauma relief teacher in Latin America. I worked with people who lost their homes in Villa La Angostura, with orphans, and with teenagers in conflict with the law. I learned that behind every difficult exterior, there\u2019s a story and there\u2019s love.",
        },
        {
          label: "Professional",
          title: "The bridge between engineering and people",
          description:
            "At Carewell, I rebuilt a healthcare platform so exhausted family caregivers could find what they need faster. At Est\u00e9e Lauder, a React component library serving 200+ ecommerce sites wasn\u2019t about code \u2014 it was about the person trying to buy a product. At every company, I ended up as the bridge between engineering and product \u2014 because I see the humans, not just the code.",
        },
      ],
      variant: "tan",
    },
  ],
  beyond: {
    heading: "Beyond the code",
    subheading: "The same principles, away from the screen.",
    items: [
      {
        label: "Teaching",
        title: "Talks and teaching on wellbeing",
        description:
          "Certified Art of Living teacher since 2022. I give talks on habits, meditation and conscious leadership at wellness events, and facilitate a weekly meditation and writing gathering in Buenos Aires.",
      },
      {
        label: "Service",
        title: "Another way to grow up",
        description:
          "Three years teaching teenagers in a Buenos Aires slum \u2014 breathing techniques, human values, how to play again. Helping them leave crime behind and see that another path exists.",
      },
      {
        label: "Practice",
        title: "9 years of daily practice",
        description:
          "Sudarshan Kriya and meditation, every single day for 9 years. Joy isn\u2019t accidental \u2014 it\u2019s a discipline.",
      },
    ],
    photoAlt: "Hari giving a talk at a wellness event",
  },
  now: {
    heading: "What I\u2019m Building Right Now",
    subheading:
      "I\u2019m always building something \u2014 in code, in community, or in myself. Here\u2019s what I\u2019m working on these days.",
    items: [
      {
        categoryKey: "teaching",
        categoryLabel: "Teaching",
        title: "1:1 Mentorship",
        description:
          "Individual accompaniment with weekly sessions, in three-month cycles. A process shaped around you, with the tools I use on myself.",
        status: "Happening now",
        cta: {
          label: "Learn more",
          href: "/en/mentoria",
        },
      },
      {
        categoryKey: "teaching",
        categoryLabel: "Teaching",
        title: "Sinergia \u2014 Meditation + reading/writing",
        description:
          "Weekly gathering on Wednesdays at 7:30pm in Palermo. Meditation, time with a book or a blank page, and an optional dinner to stay for. By donation, no experience required.",
        status: "Every Wednesday",
        cta: {
          label: "Save your seat",
          href: "/en/sinergia",
        },
      },
      {
        categoryKey: "building",
        categoryLabel: "Building",
        title: "Technology & AI Partner for Businesses",
        description:
          "I help businesses bring their operations into the digital world \u2014 from AI-powered automation to full product builds. Most recently: a ticketing and payments platform for a community event \u2014 MercadoPago checkout, QR tickets validated at the door, automated emails \u2014 built end to end. If you need a partner who understands both the tech and the business, let\u2019s talk.",
        status: "Ongoing",
        cta: { label: "Get in Touch", href: "mailto:dev@harisolaas.com" },
      },
      {
        categoryKey: "personal",
        categoryLabel: "Personal",
        title: "Follow My Adventures",
        description:
          "Keeping adventure, art, travel and physical challenges as part of my everyday life. Follow along on Instagram.",
        status: "Ongoing",
        cta: {
          label: "Follow on Instagram",
          href: "https://instagram.com/harisolaas",
        },
      },
      {
        categoryKey: "community",
        categoryLabel: "Community",
        title: "BROTE \u2014 100 trees in the ground",
        description:
          "We closed the BROTE cycle: a reforestation party where every ticket planted a tree, and a closing plantation with Un \u00c1rbol at a nature reserve in San Miguel, ~30 of us with shovels in hand. 100 native trees planted in total.",
        status: "Cycle closed \u00b7 April 2026",
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
          "Began meditating at 15; at 16, became the youngest Art of Living trauma relief teacher in Latin America.",
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
          "Taught emotional-regulation techniques to orphans, at-risk youth, and teenagers in conflict with the law.",
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
      "I work as a senior technology consultant \u2014 helping companies build the right products with the right technologies, including AI that genuinely serves your team and your users. Consulting is how I usually work, and I\u2019m open to the right full-time role. If you want an engineer who cares about your problem as much as you do, let\u2019s talk.",
    caseStudyLabel: "Read the Carewell Case Study on Toptal",
    linkLabels: {
      email: "Email",
      linkedin: "LinkedIn",
      toptal: "Toptal",
      instagram: "Instagram",
    },
    copyEmail: "copy email",
    copiedEmail: "copied ✓",
  },
  footer: {
    copyright: "Harald Solaas \u2014 harisolaas.com",
    buildLine: "hand-built with next.js \u00b7 no template",
  },
  brote: {
    meta: {
      title: "BROTE \u2014 Reforestation party",
      description:
        "Live music, catering, and a night with purpose. Every ticket plants a real tree in Argentina. Thursday August 20.",
      ogDescription:
        "Live music, catering, and a night with purpose. Every ticket plants a real tree in Argentina.",
    },
    topbar: { left: "Party", right: "2026" },
    hero: {
      cta: "I want my ticket",
      textureAlt: "Textures of tree rings and leaf veins",
    },
    infoBar: {
      date: { label: "August", value: "20" },
      time: { label: "Schedule", value: "7–10:30 PM" },
      place: { label: "Palermo", value: "CABA" },
    },
    eyebrows: {
      lineup: "Line up",
      pricing: "Tickets",
    },
    lineup: {
      timeRange: "7:00 \u2192 10:30 PM",
      welcome: {
        number: "01",
        time: "7:00 PM \u00b7 Doors",
        title: "Not sure who to come with?",
        kicker: "Come anyway. We\u2019ll be there.",
        body1:
          "We start easy: something to eat, something to drink, and a full hour just to meet people. Those of us putting this together are at the door and inside, talking to everyone \u2014 if you\u2019re coming on your own, we\u2019ll introduce you around.",
        body2:
          "The purpose-driven brands backing us will be there too, so you can get to know them up close.",
      },
      live: {
        number: "02",
        time: "8:00 PM \u00b7 Live",
        title: "Live acoustic\nmusic",
        body: "Jos\u00e9 Dezanzo, alone with a guitar. There isn\u2019t much more to explain: you just listen.",
      },
      dj: {
        number: "03",
        time: "9:15 PM \u00b7 Close",
        title: "DJ set",
        bodyBefore: "We\u2019re joined by ",
        bodyAfter:
          " for a performative dance intervention that sets the pulse through to the close.",
        link: {
          url: "https://www.instagram.com/gianbejarano/",
          name: "Gian Bejarano",
          label: "gianbejarano",
        },
      },
    },
    impact: {
      counterLabel: "Trees planted so far",
    },
    pricing: {
      earlyBirdLabel: "Early bird",
      earlyBirdBadge: "-25%",
      earlyBirdExpired: "Early bird ended",
      earlyBirdUntil: "Until August 13",
      earlyBirdClosed: "Closed August 13",
      savingsLine: "That’s today’s price. You save {savings} off general.",
      includesLink: "What’s included?",
      generalNote: "From August 14 it goes to {price}, while they last.",
      payment: "Pay with MercadoPago / card / bank transfer.",
    },
    includes: {
      eyebrow: "What’s included in your ticket?",
      items: [
        {
          number: "01",
          title: "A tree in your name",
          body: "Planted in Argentina with Un Árbol. Real, in a real place.",
        },
        {
          number: "02",
          title: "A Matelab drink",
          body: "Cold, waiting for you the moment you arrive.",
        },
        {
          number: "03",
          title: "The show",
          body: "Live acoustic music and a DJ set, start to finish.",
        },
      ],
      featured: {
        number: "04",
        title: "A seedling to take home",
        body: "We sow it together that same night. You take it with you, plant it where you live, and it keeps growing long after the party is over.",
      },
    },
    community: {
      intro: {
        before: "This comes from ",
        sponsors: "The Art of Living",
        after:
          ", a community practicing breathwork, yoga, and service across 180 countries worldwide.",
      },
      body: "We don\u2019t organize events: we create experiences where what you do on the outside reflects what you cultivate within.",
      tagline: "This party is for everyone \u00b7 Come as you are",
    },
    final: {
      heading: "Are you coming?",
      compactDate: "Thu Aug 20",
      compactTime: "7:00\u201310:30 PM",
      address: "Costa Rica 5644",
      cta: "I want my ticket",
      plantingPrompt: "Can\u2019t make it?",
      plantingCta: "Join the planting \u2192",
    },
    footer: {
      left: "Brote",
      right: "In partnership with Un \u00c1rbol",
    },
    checkoutError:
      "We couldn't open the payment. Try again in a moment, or message us on WhatsApp.",
    success: {
      title: "BROTE \u2014 You\u2019re in!",
      heading: "You\u2019re part of the forest now!",
      body: "Because of you, a new tree will take root in Argentina. That\u2019s real, and it\u2019s because of what you chose to do today. See you on August 20 to celebrate together.",
      emailNote: "Your ticket with the QR code will arrive at the email you used in MercadoPago in the next few minutes. Check your inbox and spam.",
      noEmail: "Didn\u2019t get the email? Reach out and we\u2019ll sort it out.",
      whatsappCta: "Message me on WhatsApp",
      backLink: "Back to BROTE",
      pending: {
        heading: "Your payment is on its way",
        body: "You chose a payment method that takes a while to clear. As soon as it's confirmed, your ticket with the QR arrives — that can take a couple of days if you paid in cash.",
        emailNote:
          "We'll send it to your MercadoPago account email. If you'd rather get it somewhere else, leave your details below and we'll send it there.",
      },
      contact: {
        heading: "Where should we send your ticket?",
        intro:
          "We're sending it to your MercadoPago account email. If you'd rather get it somewhere else, confirm it here and we'll resend — same QR.",
        optionalNote:
          "This is optional. If your MercadoPago email works for you, you're done.",
        nameLabel: "Your name",
        emailLabel: "Email",
        emailHelper: "This is where the ticket with the QR arrives.",
        phoneLabel: "WhatsApp",
        phonePlaceholder: "+54 9 11 2255 5110",
        phoneHelper:
          "Only so we can reach you on the day if something comes up — a time change, an emergency.",
        submit: "Confirm",
        submitting: "Confirming…",
        doneApplied:
          "Done. We resent your ticket to that address — check spam too.",
        doneSaved:
          "Saved. Your ticket already went to that address: if you don't see it, check spam or message us on WhatsApp.",
        donePending:
          "Saved. As soon as the payment clears, your ticket goes to that address.",
        errors: {
          nameRequired: "Add your name.",
          emailInvalid: "Check the email.",
          phoneInvalid: "Check the WhatsApp number.",
          emailTaken:
            "That email already has a BROTE ticket. Use another one, or message us on WhatsApp.",
          generic: "We couldn't save it. Try again in a moment.",
        },
      },
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
    messagesHeading: "Words of encouragement",
    registration: {
      heading: "Sign up to plant",
      subtitle: "Free, but limited. {remaining} of 40 spots left.",
      subtitleFull: "All 40 spots are taken. Drop your email for the waitlist.",
      helper: "Leave us your name and email. We\u2019ll send the exact address, the schedule, and everything you need to know.",
      namePlaceholder: "Your name",
      emailPlaceholder: "Your email",
      phonePlaceholder: "Your WhatsApp (e.g. +54 9 11 2255 5110)",
      phoneHelper: "So we can reach you with the meeting point and last-minute updates.",
      nameError: "Enter your name",
      emailError: "Invalid email",
      phoneError: "Enter a valid WhatsApp (e.g. +54 9 11 2255 5110)",
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

  sinergia: {
    meta: {
      title: "Sinergia — One hour a week to come back to yourself",
      description:
        "A weekly meditation and reading/writing gathering. Wednesdays 7:30pm in Palermo, Buenos Aires. By donation, no experience required.",
      ogDescription:
        "One hour a week, come back to yourself. 90 minutes of connection and a table to stay at if you want.",
    },
    hero: {
      eyebrow: "Meditation + READING/WRITING gathering",
      title: "One hour a week to come back to yourself.",
      subtitle:
        "Wednesdays 7:30pm in Palermo. By donation, no experience required.",
      cta: "Save your seat",
      seatsLabel: "{remaining} of {capacity} seats left",
      seatsFullLabel: "Full for this Wednesday",
    },
    what: {
      heading: "What Sinergia is",
      intro:
        "Ninety minutes of connection, and a table to stay at if you want. Dinner is optional.",
      schedule: [
        {
          time: "7:30pm",
          title: "Meditation and pranayama",
          description:
            "We open by tuning everyone to the same frequency. Breathwork, guided meditation.",
        },
        {
          time: "8:00pm",
          title: "Reading or writing",
          description:
            "Time alone with a text, or with a blank page of your choice. If you don’t know what to read, we have a library full of good options.",
        },
        {
          time: "8:30pm",
          title: "We share and listen",
          description:
            "Whatever came up. No debate, no obligation to speak.",
        },
        {
          time: "9:00pm",
          title: "Open dinner",
          description: "Optional. Tasty, home-cooked food.",
        },
      ],
    },
    hosts: {
      heading: "Two of us hold this",
      hari: {
        name: "Hari",
        role: "Leads the practice. Yoga and meditation teacher at Sky Campus.",
      },
      coni: {
        name: "Coni",
        role: "Meditator. Engine, support, and guide of the creative space.",
      },
      closing: "Sinergia lives inside Sky Campus, our home in Palermo.",
    },
    frictions: {
      heading: "How it works",
      items: [
        {
          title: "By donation",
          description: "You contribute what feels right.",
        },
        {
          title: "No experience required",
          description:
            "If you\u2019ve never meditated, it\u2019s fine. We\u2019ll guide you on the spot.",
        },
        {
          title: "Come when you can",
          description:
            "This isn\u2019t a course. Come one Wednesday, or every Wednesday. The space is here.",
        },
      ],
    },
    rsvp: {
      heading: "Save your spot",
      subtitle:
        "We ask for the spot to make sure there\u2019s a place for you. {remaining} of {capacity} left.",
      subtitleFull:
        "This Wednesday is full. Try again next week.",
      subtitleOverride:
        "You have an invite to come even though it's full. Sign up below.",
      helper: "We\u2019ll email you the address and how to get there.",
      namePlaceholder: "Your name",
      emailPlaceholder: "Your email",
      phonePlaceholder: "Your WhatsApp (e.g. +54 9 11 2255 5110)",
      phoneHelper: "So we can reach you with changes and coordinate in the moment.",
      nameError: "Enter your name",
      emailError: "Invalid email",
      phoneError: "Enter a valid WhatsApp (e.g. +54 9 11 2255 5110)",
      dinnerError: "Pick whether you'll stay for dinner",
      dinnerLabel: "Staying for dinner?",
      dinnerYes: "Yes, I\u2019ll stay",
      dinnerNo: "No, just the practice",
      cta: "Save my seat",
      ctaWithDonation: "Save my seat + contribute {amount}",
      submitting: "Saving...",
      successHeading: "Done.",
      successMessage:
        "We sent the address and details to your inbox. See you Wednesday.",
      alreadyRegistered:
        "You already had a seat for this Wednesday. Check your email.",
      errorMessage: "Something went wrong. Please try again.",
      micro: "We\u2019ll write to the address you leave.",
      donation: {
        heading: "Want to add a contribution?",
        subtitle:
          "Sinergia runs on community contributions. What you chip in keeps the door open every Wednesday.",
        chip5k: "$5,000",
        chip10k: "$10,000",
        chip20k: "$20,000",
        customChip: "Other amount",
        customPlaceholder: "Amount in ARS",
        declineCheckbox: "I\u2019d rather save my seat without contributing this time",
        chooseError:
          "Pick an amount or check \u201csave my seat without contributing\u201d.",
        minAmountError: "Minimum is $1,000.",
      },
    },
    successPage: {
      title: "Thanks for your contribution \u2014 Sinergia",
      eyebrow: "Thank you",
      heading: "Thanks for chipping in.",
      body: "We received your contribution. What we pool together keeps this space alive.",
      sessionLine: "See you {date} at {time}.",
      addressLine: "{venue} \u00b7 {address}",
      whatsappCta: "Message us on WhatsApp",
      backLink: "Back to Sinergia",
    },
    failurePage: {
      title: "Payment not completed \u2014 Sinergia",
      heading: "The payment didn\u2019t go through.",
      body: "Don\u2019t worry: your seat is still confirmed. You can try contributing again any time, or just show up.",
      rsvpStillConfirmed: "Your RSVP for next Wednesday is set.",
      retryCta: "Try again",
      whatsappCta: "Message us on WhatsApp",
      backLink: "Back to Sinergia",
    },
    final: {
      heading: "See you Wednesday.",
      subtitle: "One hour a week that\u2019s just yours.",
      cta: "Save your seat",
    },
  },
  sinergiaParrafo: {
    meta: {
      title: "Sinergia \u00d7 P\u00e1rrafo \u2014 Meditation, reading, and lunch",
      description:
        "Saturday May 16, 10am to 4pm. Meditation, reading, and a shared lunch. A collaboration between Sinergia and the reading club P\u00e1rrafo. 50 seats.",
      ogDescription:
        "A day to slow down, read in good company, and share a long table. Sinergia \u00d7 P\u00e1rrafo \u2014 May 16.",
    },
    hero: {
      eyebrow: "Sinergia \u00d7 P\u00e1rrafo",
      title: "A day to meditate, read, and share a table.",
      subtitle:
        "A collaboration between Sinergia and the reading club P\u00e1rrafo. Bring a book; leave with time recovered.",
      dateLine: "Saturday May 16 \u00b7 10am\u20134pm \u00b7 Palermo",
      cta: "Save my seat",
      seatsLabel: "{remaining} of {capacity} seats left",
      seatsFullLabel: "Sold out",
    },
    what: {
      heading: "What the day looks like",
      intro:
        "Six hours to drop the week\u2019s pace. We open in silence, read, talk, and stay for lunch.",
      schedule: [
        {
          time: "10:00",
          title: "Welcome and meditation",
          description:
            "Arrival, tea, and a guided meditation and breathwork session to land.",
        },
        {
          time: "11:00",
          title: "First reading round",
          description:
            "Time alone with the book you brought. If you didn\u2019t bring one, we have a library of options.",
        },
        {
          time: "12:30",
          title: "Conversation with P\u00e1rrafo",
          description:
            "The reading club P\u00e1rrafo opens a conversation around a shared text. No debate, no obligation to speak.",
        },
        {
          time: "13:30",
          title: "Shared lunch",
          description:
            "Home-cooked food included. The long table is part of the gathering \u2014 stay as long as you like.",
        },
        {
          time: "15:00",
          title: "Free reading and close",
          description:
            "A looser final round \u2014 read, write, or just be. We close at 4pm.",
        },
      ],
    },
    hosts: {
      heading: "Who holds it",
      sinergia: {
        name: "Sinergia",
        role: "The weekly meditation and reading space we run at Sky Campus, Palermo.",
      },
      parrafo: {
        name: "P\u00e1rrafo",
        role: "A reading club that brings people together around texts to read and talk without solemnity.",
      },
      closing:
        "It\u2019s the first time we\u2019re putting something together. We wanted it long, slow, and with a shared table.",
    },
    practical: {
      heading: "What to know",
      items: [
        {
          title: "Limited seats",
          description: "50 seats. The table sets the cap.",
        },
        {
          title: "Lunch included",
          description:
            "Home-cooked food, vegetarian options. Tell us about any restrictions when you sign up.",
        },
        {
          title: "Bring a book",
          description:
            "Whatever you\u2019re reading or want to start. We also have a library if you arrive empty-handed.",
        },
        {
          title: "No experience required",
          description:
            "If you\u2019ve never meditated, that\u2019s fine. We\u2019ll guide you on the spot.",
        },
      ],
    },
    rsvp: {
      heading: "Save your seat",
      subtitle:
        "{remaining} of {capacity} seats left. The seat is confirmed once payment goes through.",
      subtitleFull: "We\u2019re sold out. Message us on WhatsApp for the waitlist.",
      helper:
        "We\u2019ll take you to MercadoPago to confirm. Card, debit, and account money accepted.",
      namePlaceholder: "Your name",
      emailPlaceholder: "Your email",
      phonePlaceholder: "Your WhatsApp (e.g. +54 9 11 2255 5110)",
      phoneHelper:
        "We use it to coordinate the day and reach you if anything changes.",
      nameError: "Enter your name",
      emailError: "Invalid email",
      phoneError: "Enter a valid WhatsApp (e.g. +54 9 11 2255 5110)",
      cta: "Pay {amount} and save my seat",
      submitting: "Setting up payment...",
      redirecting: "Taking you to MercadoPago...",
      errorMessage: "Something went wrong. Please try again in a moment.",
      priceLine: "Ticket \u00b7 {amount} ARS",
    },
    successPage: {
      title: "Seat confirmed \u2014 Sinergia \u00d7 P\u00e1rrafo",
      eyebrow: "Thank you",
      heading: "Your seat is reserved.",
      body: "We received your payment. See you Saturday, May 16.",
      sessionLine: "Saturday May 16 \u00b7 10am\u20134pm",
      addressLine: "{venue} \u00b7 {address}",
      emailNote:
        "We sent you an email with your ticket and the details. If you don\u2019t see it, check spam.",
      whatsappCta: "Message us on WhatsApp",
      backLink: "Back",
    },
    failurePage: {
      title: "Payment not completed \u2014 Sinergia \u00d7 P\u00e1rrafo",
      heading: "The payment didn\u2019t go through.",
      body: "Don\u2019t worry \u2014 nothing was charged. You can try again or message us on WhatsApp if you need another payment option.",
      retryCta: "Try again",
      whatsappCta: "Message us on WhatsApp",
      backLink: "Back",
    },
    final: {
      heading: "See you on the 16th.",
      subtitle: "A long, slow day with a shared table.",
      cta: "Save my seat",
    },
  },
  mentoria: {
    meta: {
      title: "1:1 Mentorship — Harald Solaas",
      description:
        "Individual accompaniment with weekly sessions, in three-month cycles. A process shaped around each person.",
      ogDescription:
        "Individual accompaniment with weekly sessions, in three-month cycles. A process shaped around each person.",
    },
    hero: {
      eyebrow: "1:1 Mentorship",
      heading: "Individual accompaniment, one session a week.",
      intro:
        "Weekly one-on-one sessions, in three-month cycles. A process shaped around you, with the tools I've used on myself for over fifteen years.",
    },
    // Testimonials from Cris (first mentee) — sources: Sesión Cris 2026-07-22
    // and 2026-07-29. Publication pending his explicit OK before merge.
    testimonials: [
      {
        text: "A big change in my life, without a doubt: priorities and order back where they belong.",
        name: "Cris",
        role: "entrepreneur — three months into the mentorship",
      },
      {
        text: "You were the person I needed to find this year. You made me reconnect with so many things.",
        name: "Cris",
      },
    ],
    sections: {
      forWho: {
        heading: "Who it's for",
        paragraphs: [
          "People building and leading something real: a business, a team, a project they care about. People who have already proven they can work hard, and now want that force to stop costing them their peace.",
          "You don't need to arrive in crisis. Not wanting to keep choosing between the business and the inner life is enough.",
        ],
        quote: "The moment you say “I've got it,” your alertness drops.",
      },
      what: {
        heading: "What it is",
        paragraphs: [
          "Individual accompaniment, with weekly sessions. Each process takes shape around the person living it — you won't be walked through someone else's program.",
          "Meditation, breathwork, writing, readings, concrete practices or an honest conversation — what shows up in each session depends on what you're going through, not on a syllabus.",
        ],
        quote:
          "The tools that show up aren't a method: they're the ones on my own belt, because I use them on myself.",
      },
      how: {
        heading: "How we work",
        paragraphs: [
          "One session a week, over video call or in person in Buenos Aires. Between sessions, whatever is needed: a practice, a reading, a message at the right time.",
          "We work in three-month cycles — that's the minimum commitment. At the close of each cycle we decide whether to continue. For the past few months I've been accompanying an entrepreneur this way, week after week.",
        ],
        quote:
          "Seeing what's underneath: the hidden motivations, the real knot beneath the symptom. That's the raw material of what I do as a mentor.",
        imageAlt:
          "Hari speaking outdoors to a seated group, in natural light.",
      },
      whyMe: {
        heading: "Why me",
        paragraphs: [
          "I started meditating at 15 and teaching at 16. I've spent a decade as a senior software engineer — most of it for Silicon Valley companies — and just as long teaching meditation and accompanying human processes. I never chose between the two lives: I learned to let them feed each other.",
          "That's what I offer: someone who knows from the inside the pressure of building — the numbers, the teams, the ambition — and who has kept up, for years, the practices that stop that pressure from eating you.",
        ],
        quote:
          "The idea changes, and the practice has to carry you through that. That's what discipline is.",
        imageAlt: "Portrait of Hari Solaas, in natural light.",
      },
    },
    practical: {
      heading: "The practical part",
      items: [
        {
          label: "Format",
          value: "1:1 sessions, over video call or in person (Buenos Aires)",
        },
        {
          label: "Frequency",
          value: "Weekly, with accompaniment between sessions",
        },
        {
          label: "Commitment",
          value: "Three-month cycles",
        },
      ],
      note: "We start with a conversation. If I'm not the right person to accompany you, I'll be the one to tell you.",
    },
    cta: {
      heading: "Let's start with a conversation",
      body: "Write to me and tell me where you're at. No commitment, no script: a chat to see whether this is for you.",
      buttonLabel: "Message me on WhatsApp",
      // CTA destination: WhatsApp per site convention. Swappable — the final
      // CTA destination is an open owner decision.
      href: "https://wa.me/5491122555110?text=Hi%21%20I%27d%20like%20to%20know%20more%20about%20the%201%3A1%20mentorship",
    },
  },
};

export default en;
