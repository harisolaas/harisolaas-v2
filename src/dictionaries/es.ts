import type { Dictionary } from "./types";

const es: Dictionary = {
  metadata: {
    title: "Harald Solaas \u2014 Tecnolog\u00eda al servicio de las personas",
    description:
      "Ingeniero de Software Senior y Consultor Tecnol\u00f3gico. Desde soluciones de IA hasta productos full-stack, construyo tecnolog\u00eda al servicio de las personas \u2014 y comunidades que me trasciendan.",
    keywords: [
      "Harald Solaas",
      "Hari Solaas",
      "Ingeniero de Software Senior",
      "Consultor Tecnol\u00f3gico",
      "Soluciones de IA",
      "Consultor de IA",
      "React",
      "Next.js",
      "Desarrollador Full Stack",
    ],
    ogTitle: "Harald Solaas \u2014 Tecnolog\u00eda al servicio de las personas",
    ogDescription:
      "Ingeniero de Software Senior y Consultor Tecnol\u00f3gico. Desde soluciones de IA hasta productos full-stack, construyo tecnolog\u00eda al servicio de las personas y comunidades que me trasciendan.",
    twitterTitle:
      "Harald Solaas \u2014 Tecnolog\u00eda al servicio de las personas",
    twitterDescription:
      "Ingeniero de Software Senior y Consultor Tecnol\u00f3gico. Construyo tecnolog\u00eda al servicio de las personas.",
  },
  nav: {
    brand: "Hari",
    values: "Valores",
    now: "Ahora",
    story: "Historia",
    contact: "Contacto",
    toggleMenu: "Abrir men\u00fa",
  },
  hero: {
    name: "Harald Solaas",
    tagline:
      "Empec\u00e9 a meditar a los 15, a ense\u00f1ar a los 16 y a programar a los 20. No dej\u00e9 de hacer ninguna.",
    scrollCta: "Scrolle\u00e1 para conocerme",
    photoAlt: "Harald Solaas",
  },
  values: [
    {
      id: "outlive",
      statement: "Construyo cosas que me trascienden.",
      proofPoints: [
        {
          label: "Comunidad",
          title: "50 voluntarios, 500+ vidas impactadas",
          description:
            "Lider\u00e9, junto a un equipo, a 50 voluntarios para ense\u00f1ar a m\u00e1s de 500 personas en una villa de Buenos Aires. Constru\u00ed la infraestructura de voluntarios y despu\u00e9s migr\u00e9 al pr\u00f3ximo desaf\u00edo. El programa contin\u00faa hasta el d\u00eda de hoy.",
        },
        {
          label: "Personal",
          title: "Un equipo de b\u00e1squet desde cero",
          description:
            "Arm\u00e9 un equipo de b\u00e1squet a los 29 porque ya estaba grande para sumarme a un club. Lo arm\u00e9 de la nada, desarroll\u00e9 al equipo, la log\u00edstica, jugu\u00e9 dos a\u00f1os y me fui por una lesi\u00f3n. El equipo sigui\u00f3 compitiendo dos a\u00f1os m\u00e1s.",
        },
        {
          label: "Profesional",
          title: "De 14 explosiones de producci\u00f3n a casi cero",
          description:
            "En Cruise (veh\u00edculos aut\u00f3nomos, Silicon Valley), hered\u00e9 una base de c\u00f3digo con 20% de cobertura de tests y 14 ca\u00eddas por mes. Lo dej\u00e9 en 70%+ de cobertura con 0.3 incidentes por mes. La infraestructura de testing que constru\u00ed se convirti\u00f3 en la base del equipo.",
        },
      ],
      photoAlt: "Trabajo voluntario comunitario en Buenos Aires",
      photoSrc: "/community.jpg",
      variant: "cream",
    },
    {
      id: "humans",
      statement: "Veo a las personas detr\u00e1s del sistema.",
      proofPoints: [
        {
          label: "Origen",
          title: "Hijo de un psic\u00f3logo",
          description:
            "Mi padre era psic\u00f3logo y consultor organizacional. Desde chico aprend\u00ed a ver los sistemas como conjuntos de personas \u2014 sus motivaciones, recompensas y sentido de pertenencia.",
        },
        {
          label: "Formativo",
          title:
            "El profesor de alivio del trauma m\u00e1s joven de Latinoam\u00e9rica",
          description:
            "A los 15, me convert\u00ed en el profesor de alivio de trauma m\u00e1s joven de El Arte de Vivir en Latinoam\u00e9rica. Trabaj\u00e9 con personas que perdieron sus hogares en Villa La Angostura. Trabaj\u00e9 con hu\u00e9rfanos, j\u00f3venes en rehabilitaci\u00f3n y en procesos judiciales. Aprend\u00ed que detr\u00e1s de cada exterior dif\u00edcil, hay una historia y hay amor.",
        },
        {
          label: "Profesional",
          title: "El puente entre la ingenier\u00eda y las personas",
          description:
            "En Carewell, reconstru\u00ed una plataforma de salud para que familiares agotados que cuidan de adultos mayores puedan encontrar lo que necesitan m\u00e1s r\u00e1pido. En Est\u00e9e Lauder, una librer\u00eda de componentes React sirviendo 200+ sitios de ecommerce no se trataba de c\u00f3digo \u2014 se trataba de la persona del otro lado intentando comprar un producto. En cada empresa, termin\u00e9 siendo el puente entre ingenier\u00eda y producto \u2014 porque veo a las personas, no solo el c\u00f3digo.",
        },
      ],
      photoAlt: "Trabajando con j\u00f3venes en entornos comunitarios",
      photoSrc: "/working-with-youth.jpg",
      variant: "tan",
    },
    {
      id: "percentile",
      statement: "Voy por el \u00faltimo 1%.",
      proofPoints: [
        {
          label: "Cruise",
          title: "Anal\u00edtica de veh\u00edculos aut\u00f3nomos",
          description:
            "Constru\u00ed la plataforma de anal\u00edtica usada por ejecutivos y personal de operaciones de toda la empresa. Reduje el tiempo de ejecuci\u00f3n un 90% en componentes cr\u00edticos.",
          metrics: [
            {
              value: "20\u219270%",
              label: "Cobertura de tests en 3 meses",
            },
            { value: "14\u21920.3", label: "Ca\u00eddas por mes" },
            {
              value: "90%",
              label: "Reducci\u00f3n tiempo de ejecuci\u00f3n",
            },
          ],
        },
        {
          label: "Carewell",
          title: "Reconstrucci\u00f3n de plataforma de salud de $21M",
          description:
            "Fui parte clave de un equipo de 4 ingenieros que reconstruy\u00f3 una plataforma de ecommerce de salud de USD $21M con React, Next.js, Tailwind CSS y GraphQL. El sitio carga instant\u00e1neamente, funciona sin JavaScript y logra puntajes SEO excepcionales. Se lanz\u00f3 a tiempo, con mayor engagement y ventas.",
          metrics: [
            { value: "$21M", label: "Plataforma reconstru\u00edda" },
            { value: "100", label: "Performance en Lighthouse" },
          ],
        },
        {
          label: "Est\u00e9e Lauder",
          title: "200+ sitios de marcas en todo el mundo",
          description:
            "Constru\u00ed componentes flexibles y reutilizables sirviendo 200+ sitios de marcas a nivel global. Reduje el tiempo a primera interacci\u00f3n. Multi-tenancy al extremo \u2014 cada deploy importa cuando cientos de miles de usuarios dependen de \u00e9l diariamente.",
          metrics: [
            { value: "200+", label: "Sitios servidos" },
            { value: "60\u219285%", label: "Cobertura de tests" },
          ],
        },
      ],
      quote: {
        text: "No dejar nada para despu\u00e9s. Ir hasta el \u00faltimo 1% de hacer que la experiencia del usuario sea incre\u00edble. Optimizar tanto como tenga sentido, tanto como agregue valor.",
      },
      photoAlt: "Excelencia t\u00e9cnica y precisi\u00f3n",
      photoSrc: "/excellence.jpg",
      photoPosition: "80% center",
      variant: "cream",
    },
    {
      id: "serve",
      statement:
        "La tecnolog\u00eda debe servir a las personas, no reemplazarlas.",
      proofPoints: [
        {
          label: "Art of Living",
          title: "Plataforma de streaming para bienestar",
          description:
            "Desarrollé gamification para la plataforma de streaming de la Fundaci\u00f3n El Arte de Vivir con miles de usuarios mensuales, mejorarando el compromiso e engagement con contenido de meditaci\u00f3n y bienestar.",
        },
        {
          label: "Cruise",
          title: "Herramientas que construyen el futuro",
          description:
            "Constru\u00ed herramientas que ayudaron a ingenieros de autos, testers y cient\u00edficos de datos a visualizar cientos de miles de puntos de datos de rutas de veh\u00edculos automatizados. Construyendo las herramientas que hacen al futuro del transporte (si, autos robot... si, sin conductor).",
        },
        {
          label: "Carewell",
          title: "Tecnolog\u00eda para momentos vulnerables",
          description:
            "Hacer accesibles los suministros de salud para familias que cuidan a seres queridos mayores. Tecnolog\u00eda que reduce la fricci\u00f3n en un momento de vulnerabilidad.",
        },
        {
          label: "Nubi",
          title: "Acceso financiero para 50.000+",
          description:
            "Dimos a m\u00e1s de 50.000 latinoamericanos acceso m\u00e1s f\u00e1cil a sus fondos de PayPal \u2014 transferencias internacionales, retiros, gesti\u00f3n de tarjetas de cr\u00e9dito.",
        },
        {
          label: "Filosof\u00eda",
          title: "Inspirado por Muhammad Yunus",
          description:
            "Inspirado por el \u00abBanquero de los Pobres\u00bb \u2014 la idea de que los sistemas (financieros, tecnol\u00f3gicos, organizacionales) pueden dise\u00f1arse para servir a personas que han sido olvidadas.",
        },
      ],
      quote: {
        text: "Quiero hacer de la tecnolog\u00eda tu aliada, tu amiga \u2014 no una amenaza.",
      },
      photoAlt: "Tecnolog\u00eda al servicio de las necesidades humanas",
      photoSrc: "/for-people.png",
      variant: "forest",
    },
    {
      id: "joy",
      statement: "Traigo diversi\u00f3n al trabajo.",
      proofPoints: [
        {
          label: "B\u00e1squet",
          title: "Muy grande para unirme, as\u00ed que arm\u00e9 uno",
          description:
            "Muy grande para meterme a un equipo a los 29, as\u00ed que cre\u00e9 uno. Me sum\u00e9 a una liga amateur. Se convirti\u00f3 en algo con vida propia.",
        },
        {
          label: "Ense\u00f1anza",
          title: "Tres a\u00f1os en una villa",
          description:
            "Ense\u00f1ando a adolescentes t\u00e9cnicas de respiraci\u00f3n, valores humanos, c\u00f3mo volver a ser chicos. Ayud\u00e1ndolos a salir del crimen. Mostrando que hay otro camino.",
        },
        {
          label: "Art of Living",
          title: "Profesor desde 2022",
          description:
            "Ense\u00f1ando cursos, construyendo comunidad en redes sociales, aprendiendo a vender con autenticidad, haciendo networking, construyendo grupos de voluntarios basados en \u00e9tica.",
        },
        {
          label: "Pr\u00e1ctica diaria",
          title: "9 a\u00f1os de pr\u00e1ctica diaria",
          description:
            "9 a\u00f1os de pr\u00e1ctica diaria de Sudarshan Kriya y meditaci\u00f3n. La alegr\u00eda no es accidental \u2014 es una disciplina.",
        },
      ],
      quote: {
        text: "Divertirse mientras hacemos las cosas que hay que hacer. Celebrar nuestras victorias, aprender de nuestras derrotas y mantener la frente en alto.",
      },
      photoAlt: "Surf, b\u00e1squet o comunidad de El Arte de Vivir",
      photoSrc: "/basketball.jpg",
      variant: "tan",
    },
  ],
  now: {
    heading: "Lo que estoy armando ahora",
    subheading:
      "Siempre estoy construyendo algo \u2014 en c\u00f3digo, en comunidad o en m\u00ed mismo. Esto es en lo que estoy trabajando estos d\u00edas.",
    items: [
      {
        categoryKey: "teaching",
        categoryLabel: "Ense\u00f1anza",
        title: "Talleres de El Arte de Vivir",
        description:
          "Pr\u00f3ximas fechas para cursos de meditaci\u00f3n y t\u00e9cnicas de respiraci\u00f3n. Aprend\u00e9 Sudarshan Kriya y herramientas para manejar el estr\u00e9s, la ansiedad y el bienestar emocional.",
        status: "Pr\u00f3ximamente",
        cta: {
          label: "Ver pr\u00f3ximas fechas",
          href: "https://wa.me/5491122555110?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20los%20talleres%20de%20meditaci%C3%B3n",
        },
      },
      {
        categoryKey: "building",
        categoryLabel: "Desarrollo",
        title: "Socio tecnol\u00f3gico y de IA para negocios",
        description:
          "Ayudando a empresas a llevar sus operaciones al mundo digital \u2014 desde automatizaci\u00f3n con IA y flujos de trabajo inteligentes hasta productos completos. Si necesit\u00e1s un socio tecnol\u00f3gico que entienda tanto la tecnolog\u00eda como el negocio, hablemos.",
        status: "Sucediendo ahora",
        cta: { label: "Contactame", href: "mailto:dev@harisolaas.com" },
      },
      {
        categoryKey: "building",
        categoryLabel: "Desarrollo",
        title: "Soluciones de IA al servicio de las personas",
        description:
          "Construyendo herramientas con IA que genuinamente ayudan \u2014 no reemplazan \u2014 a las personas que las usan. Desde automatizaci\u00f3n inteligente hasta integraciones de IA a medida, siempre con el humano en el centro.",
        status: "Sucediendo ahora",
        cta: { label: "Contactame", href: "mailto:dev@harisolaas.com" },
      },
      {
        categoryKey: "personal",
        categoryLabel: "Personal",
        title: "Segu\u00ed mis aventuras",
        description:
          "Mantengo la aventura, el arte y los desaf\u00edos f\u00edsicos como parte de mi d\u00eda a d\u00eda. Seguime en Instagram.",
        status: "En progreso",
        cta: {
          label: "Seguime en Instagram",
          href: "https://instagram.com/harisolaas",
        },
      },
      {
        categoryKey: "community",
        categoryLabel: "Comunidad",
        title: "BROTE \u2014 Fiesta de reforestaci\u00f3n",
        description:
          "M\u00fasica en vivo, caf\u00e9 de especialidad, DJ set y una tarde con sentido. Cada entrada planta un \u00e1rbol real en Argentina. S\u00e1bado 28 de marzo, Palermo.",
        status: "28 de marzo",
        cta: {
          label: "Quiero mi entrada",
          href: "/es/brote",
        },
      },
      {
        categoryKey: "teaching",
        categoryLabel: "Ense\u00f1anza",
        title: "Respiraci\u00f3n y liderazgo para j\u00f3venes",
        description:
          "Programas en curso con estudiantes universitarios y j\u00f3venes profesionales, combinando respiraci\u00f3n, meditaci\u00f3n y herramientas pr\u00e1cticas para fortalecer la resiliencia emocional, el prop\u00f3sito y el liderazgo consciente.",
        status: "Sucediendo ahora",
        cta: {
          label: "Participar",
          href: "https://wa.me/5491122555110?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20los%20cursos%20de%20meditaci%C3%B3n",
        },
      },
    ],
  },
  timeline: {
    heading: "La historia completa",
    subheading: "Un arco compacto desde los 15 hasta hoy.",
    expand: "Ver la l\u00ednea de tiempo",
    collapse: "Ocultar la l\u00ednea de tiempo",
    techHeading: "Tecnolog\u00edas",
    entries: [
      {
        year: "2009",
        title: "Art of Living \u2014 15 a\u00f1os",
        description:
          "Comenc\u00e9 la pr\u00e1ctica de meditaci\u00f3n y la formaci\u00f3n como profesor de alivio de trauma. El profesor m\u00e1s joven de El Arte de Vivir en Latinoam\u00e9rica.",
        type: "life",
      },
      {
        year: "2011\u20132012",
        title: "Villa La Angostura",
        description:
          "Apoyo comunitario post-desastre \u2014 trabajando con personas que perdieron sus hogares.",
        type: "community",
      },
      {
        year: "2011\u20132012",
        title: "Servicio",
        description:
          "Ense\u00f1\u00e9 t\u00e9cnicas de manejo emocional a hu\u00e9rfanos, j\u00f3venes en rehabilitaci\u00f3n y procesos judiciales.",
        type: "community",
      },
      {
        year: "2014\u20132017",
        title: "Universidad de Belgrano",
        description:
          "Licenciatura en Administraci\u00f3n de Empresas. Empec\u00e9 a programar a los 20 por necesidad en concursos de emprendedurismo.",
        type: "life",
      },
      {
        year: "2016\u2013Presente",
        title: "Ingeniero de Software Independiente",
        description:
          "Dise\u00f1ando y construyendo sistemas reales para organizaciones de salud, servicios legales e instituciones con impacto p\u00fablico. Desde plataformas complejas de reclamos y flujos de verificaci\u00f3n hasta herramientas internas y frontends en producci\u00f3n. El momento en que la ingenier\u00eda pas\u00f3 a ser hacerse cargo, decidir bien y pensar a largo plazo. El comienzo de un oficio de por vida.",
        type: "work",
      },
      {
        year: "2016\u20132022",
        title: "Servicio comunitario",
        description:
          "Programas en villas con 50 voluntarios y 500+ participantes. Programa juvenil de f\u00fatbol de 3 a\u00f1os. Creaci\u00f3n de equipos de voluntarios.",
        type: "community",
      },
      {
        year: "2018\u20132019",
        title: "GuruDevelopers",
        description:
          "Ecommerce, plataforma de streaming de El Arte de Vivir, plugins de WordPress. Primera experiencia en una \u00abf\u00e1brica de software\u00bb real.",
        type: "work",
      },
      {
        year: "2019\u20132020",
        title: "Litebox \u2014 L\u00edder T\u00e9cnico",
        description:
          "Billetera digital Nubi (50K+ usuarios), startup de BI, apps marinas, juego m\u00f3vil (50K+ descargas), ecommerce de nutrici\u00f3n canina personalizada. Mentor\u00e9 juniors a nivel mid.",
        type: "work",
      },
      {
        year: "2020\u20132021",
        title: "The Est\u00e9e Lauder Companies",
        description:
          "Ingeniero Frontend Senior \u2014 Librer\u00eda de componentes React sirviendo 200+ sitios de ecommerce. Cobertura de tests 60%\u219285%. Multi-tenancy global a escala.",
        type: "work",
      },
      {
        year: "2021\u20132023",
        title: "Cruise v\u00eda Toptal",
        description:
          "Ingeniero de Software Senior \u2014 Plataforma de anal\u00edtica de veh\u00edculos aut\u00f3nomos. Testing 20%\u219270%, ca\u00eddas 14\u21920.3/mes. Visualizaci\u00f3n de datos con D3.js. Primera empresa de Silicon Valley.",
        type: "work",
      },
      {
        year: "2022",
        title: "Profesor de El Arte de Vivir",
        description:
          "Me certifiqu\u00e9 como profesor de los programas principales de El Arte de Vivir. Ense\u00f1ando cursos, construyendo comunidad.",
        type: "life",
      },
      {
        year: "2023",
        title: "Noruega",
        description:
          "Reconectando con mis ancestros y reconstruyendo puentes en la familia.",
        type: "life",
      },
      {
        year: "2023\u2013Presente",
        title: "Consultor Senior",
        description:
          "Carewell (reconstrucci\u00f3n de ecommerce de salud de $21M), Colgate (asesor tecnol\u00f3gico), soluciones con IA, varios clientes. Evoluci\u00f3n de ingeniero a asesor de confianza.",
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
    heading: "Construyamos algo.",
    description:
      "Trabajo como consultor tecnol\u00f3gico senior \u2014 ayudando a empresas a construir los productos correctos con las tecnolog\u00edas correctas, incluyendo soluciones de IA que genuinamente sirvan a tu equipo y a tus usuarios. Traigo experiencia profunda en ingenier\u00eda, comunicaci\u00f3n humana y una mentalidad de servicio. Si quer\u00e9s un ingeniero que se preocupe por tu problema tanto como vos, hablemos.",
    caseStudyLabel: "Leer el caso de estudio de Carewell en Toptal",
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
      title: "BROTE \u2014 Fiesta de reforestaci\u00f3n",
      description:
        "M\u00fasica en vivo, caf\u00e9 de especialidad, DJ set y una tarde con sentido. Cada entrada planta un \u00e1rbol real en Argentina. S\u00e1bado 28 de marzo.",
      ogDescription:
        "M\u00fasica en vivo, caf\u00e9 de especialidad, DJ set y una tarde con sentido. Cada entrada planta un \u00e1rbol real en Argentina.",
    },
    hero: {
      subtitle: "Fiesta de reforestaci\u00f3n",
      dateTime: "S\u00e1bado 28 de marzo \u00b7 14 a 19h \u00b7 Argentina",
      subhead:
        "M\u00fasica en vivo, caf\u00e9 de especialidad, DJ set y una tarde entera con gente que celebra con sentido. Cada entrada planta un \u00e1rbol real en Argentina.",
      cta: "Quiero mi entrada",
    },
    experience: [
      {
        icon: "\u2615",
        title: "Caf\u00e9 de especialidad y pasteler\u00eda",
        description:
          "Un stand de caf\u00e9 curado para arrancar la tarde con los sentidos abiertos.",
      },
      {
        icon: "\ud83c\udfb5",
        title: "M\u00fasica en vivo + DJ set",
        description:
          "Apertura con m\u00fasica ac\u00fastica en vivo y DJ para cerrar. De la calma al baile, todo en una tarde.",
      },
      {
        icon: "\ud83e\uddd8",
        title: "Meditaci\u00f3n grupal + intenci\u00f3n por la naturaleza",
        description:
          "Cerr\u00e1 la tarde conectando con vos y con la naturaleza. Una experiencia guiada para llevarte algo que dure m\u00e1s que la m\u00fasica.",
      },
      {
        icon: "\ud83c\udf31",
        title: "1 entrada = 1 \u00e1rbol",
        description:
          "Cada ticket planta un \u00e1rbol real en Argentina junto a Un \u00c1rbol, una ONG con m\u00e1s de 15 a\u00f1os y miles de \u00e1rboles plantados en el pa\u00eds.",
      },
    ],
    lineup: {
      toggle: "Ver el lineup",
      items: [
        {
          time: "15:00",
          title: "Apertura",
          description:
            "Caf\u00e9, pasteler\u00eda y encuentro. Un momento para llegar, conocer gente y acomodarse antes de que empiece todo.",
          link: { url: "https://www.instagram.com/nuezabsas/", label: "Nueza" },
        },
        {
          time: "15:30",
          title: "Ximena en vivo",
          description: "M\u00fasica ac\u00fastica para settear el mood.",
          link: { url: "https://www.instagram.com/ximenasmusica/", label: "Ximena" },
        },
        {
          time: "16:00",
          title: "Un \u00c1rbol",
          description:
            "Charla sobre reforestaci\u00f3n y siembra colectiva. Cada uno hace su propio brote de planta nativa y se lo lleva a casa. Seguido de una siembra de intenci\u00f3n: una meditaci\u00f3n colectiva breve para cerrar ese momento.",
          link: { url: "https://www.instagram.com/unarbol_ong/", label: "Un \u00c1rbol" },
        },
        {
          time: "17:00",
          title: "DJ set",
          description: "Baile hasta el final.",
        },
      ],
    },
    impact: {
      heading: "Tu entrada no se gasta. Se planta.",
      partner: {
        intro: "Trabajamos con ",
        name: "Un \u00c1rbol",
        rest: ", una asociaci\u00f3n civil con m\u00e1s de 15 a\u00f1os dedicada a reforestar zonas de toda Argentina. Ya hicimos un viaje de plantaci\u00f3n con ellos y vimos de primera mano c\u00f3mo trabajan.",
      },
      body: "Cada entrada financia la plantaci\u00f3n de un \u00e1rbol nativo. No es simb\u00f3lico: es un \u00e1rbol real, en un lugar real, que va a crecer mucho despu\u00e9s de que termine la m\u00fasica.",
      attendees:
        "Si vienen {count} personas, son {count} \u00e1rboles. As\u00ed de simple.",
      partnerLabel: "En alianza con",
    },
    pricing: {
      reanchor:
        "Una tarde de m\u00fasica, caf\u00e9, comunidad y un \u00e1rbol plantado a tu nombre.",
      cta: "Quiero mi entrada",
      payment: "Pag\u00e1s con MercadoPago / tarjeta / transferencia.",
      earlyBirdBadge: "Preventa \u2014 20% OFF",
      earlyBirdUntil: "Hasta el 16 de marzo",
    },
    about: {
      intro: {
        before: "Esto nace de ",
        sponsors: "Sky Campus y El Arte de Vivir",
        after:
          ", comunidades que practican respiraci\u00f3n, yoga y servicio en m\u00e1s de 100 universidades y 180 pa\u00edses del mundo.",
      },
      body: "No organizamos eventos. Creamos experiencias donde lo que hac\u00e9s por afuera refleja lo que cultiv\u00e1s por dentro.",
      closing: "Esta fiesta es abierta a todos. Ven\u00ed como sos.",
    },
    practical: {
      dateTime: "S\u00e1bado 28 de marzo \u00b7 14:00 a 19:00",
      includes:
        "Tu entrada incluye: m\u00fasica, caf\u00e9, actividades y la plantaci\u00f3n de 1 \u00e1rbol",
      bring: "Ven\u00ed con buena energ\u00eda, ropa cool y c\u00f3moda",
    },
    final: {
      heading: "\u00bfVen\u00eds?",
      cta: "Quiero mi entrada",
      plantingPrompt:
        "\u00bfNo pod\u00e9s venir pero quer\u00e9s ser parte?",
      plantingCta: "Sumate a la plantaci\u00f3n",
    },
    success: {
      title: "BROTE \u2014 \u00a1Listo!",
      heading: "\u00a1Ya sos parte del bosque!",
      body: "Gracias a vos, un \u00e1rbol nuevo va a echar ra\u00edces en Argentina. Eso es real, y es gracias a tu decisi\u00f3n de hoy. Nos vemos el 28 de marzo para celebrarlo juntos.",
      emailNote: "Tu entrada con el c\u00f3digo QR va a llegar al email que usaste en MercadoPago en los pr\u00f3ximos minutos. Revis\u00e1 tu bandeja de entrada y spam.",
      noEmail: "\u00bfNo te lleg\u00f3 el email? Escribime y lo resolvemos.",
      whatsappCta: "Escribime por WhatsApp",
      backLink: "Volver a BROTE",
    },
    failure: {
      title: "BROTE \u2014 Pago no completado",
      heading: "El pago no se complet\u00f3",
      body: "Algo sali\u00f3 mal con el pago o fue cancelado. Pod\u00e9s intentar de nuevo desde la p\u00e1gina de BROTE.",
      backLink: "Volver a BROTE",
    },
  },
  broteUnArbol: {
    headline: "Una fiesta. Un \u00e1rbol. Tu tarde.",
    message: [
      "Donar es lindo. Todav\u00eda m\u00e1s lindo es compartir un espacio de festejo con una comunidad que aporta todos los meses al medio ambiente.",
      "Para la comunidad de Un \u00c1rbol: $17.477 ARS \u2014 25% OFF sobre el precio final.",
      "Cada entrada planta un \u00e1rbol nativo en el AMBA.",
    ],
    includes: [
      "Caf\u00e9 de especialidad y pasteler\u00eda (Nueza)",
      "M\u00fasica en vivo (Ximena) + DJ set (Gaspar Insfr\u00e1n desde Paraguay)",
      "Charla de reforestaci\u00f3n + siembra colectiva \u2014 te llev\u00e1s tu planta a casa",
      "Siembra de intenci\u00f3n (meditaci\u00f3n colectiva)",
    ],
    pricingTitle: "Precios",
    pricing: [
      { label: "Comunidad Un \u00c1rbol (25% OFF)", price: "$17.477", highlight: true },
      { label: "Preventa general", price: "$18.650" },
      { label: "En puerta", price: "$23.303" },
    ],
    codePlaceholder: "Ingres\u00e1 tu c\u00f3digo",
    codeButton: "Validar",
    codeInvalid: "C\u00f3digo inv\u00e1lido. Revis\u00e1 que est\u00e9 bien escrito.",
    codeUsed: "Este c\u00f3digo ya fue utilizado.",
    cta: "Quiero mi entrada",
    loading: "Procesando...",
    backLink: "Volver a BROTE",
  },
  broteCima: {
    headline: "Corré con CIMA. Plantá con BROTE.",
    message: [
      "La comunidad de CIMA sabe lo que es moverse con propósito. Esta vez, cada paso planta un árbol.",
      "Para la comunidad de CIMA: $17.477 ARS — 25% OFF sobre el precio final.",
      "Cada entrada planta un árbol nativo en el AMBA.",
    ],
    includes: [
      "Café de especialidad y pastelería (Nueza)",
      "Música en vivo (Ximena) + DJ set (Gaspar Insfrán desde Paraguay)",
      "Charla de reforestación + siembra colectiva — te llevás tu planta a casa",
      "Siembra de intención (meditación colectiva)",
    ],
    pricingTitle: "Precios",
    pricing: [
      { label: "Comunidad CIMA (25% OFF)", price: "$17.477", highlight: true },
      { label: "Preventa general", price: "$18.650" },
      { label: "En puerta", price: "$23.303" },
    ],
    codePlaceholder: "Ingresá tu código",
    codeButton: "Validar",
    codeInvalid: "Código inválido. Revisá que esté bien escrito.",
    codeUsed: "Este código ya fue utilizado.",
    cta: "Quiero mi entrada",
    loading: "Procesando...",
    backLink: "Volver a BROTE",
  },
  plant: {
    meta: {
      title: "BROTE — El segundo movimiento",
      description: "El 19 de abril cerramos el ciclo de BROTE: meditación, plantación con Un Árbol y sobremesa en una reserva de San Miguel. Gratis, 40 lugares, requiere registración.",
      ogDescription: "El segundo movimiento de BROTE. Domingo 19 de abril en una reserva de San Miguel. Gratis con cupo limitado.",
    },
    hero: {
      eyebrow: "DOMINGO 19 DE ABRIL · 14 A 17H · SAN MIGUEL",
      title: "El segundo movimiento de BROTE.",
      subtitle: "La fiesta plantó árboles en una planilla. El 19 nos encontramos a meter las manos en la tierra con Un Árbol.",
      tag: "Gratis · 40 lugares · Reservá tu lugar para recibir la dirección",
      cta: "Reservá tu pala 🌱",
      seatsLabel: "Quedan {remaining} de 40 lugares",
      seatsFullLabel: "Se llenaron los 40 lugares",
      welcomeBack: "¡Estuviste en BROTE! Qué bueno verte de vuelta 🌱",
    },
    ritual: {
      title: "Los que vinieron a BROTE plantaron con la billetera.",
      titleLine2: "Los que vienen el 19 plantan con las manos.",
      body: "El 28 de marzo nos juntamos 80 personas en una fiesta que financió la plantación de árboles nativos con Un Árbol. Ese fue el primer movimiento. Ahora vamos a la reserva a meter las manos en la tierra, compartir una tarde y cerrar el ciclo.",
    },
    activitiesHeading: "Qué va a pasar esa tarde",
    activities: [
      {
        icon: "🌱",
        title: "Manos en la tierra",
        description: "Vas a hacer un pozo, acomodar las raíces, apretar el suelo y dejar un árbol nativo en pie.",
      },
      {
        icon: "🧘",
        title: "Meditación guiada",
        description: "Antes de plantar, un rato sentados en silencio. Para llegar bien, para bajar el ruido de la ciudad y aparecer enteros frente a la tierra.",
      },
      {
        icon: "🌮",
        title: "Food trucks y sobremesa",
        description: "Hay food trucks en la reserva, música tranquila y lugar para quedarse. Venís a plantar, pero también a pasarla bien una tarde de domingo.",
      },
      {
        icon: "🌿",
        title: "Un Árbol te cuenta",
        description: "La ONG que viene restaurando bosques nativos hace 15 años. Vas a conocer su trabajo de primera mano y entender a dónde van los árboles que no plantamos ese día — Un Árbol los sigue plantando por todo el país cuando corresponde.",
      },
    ],
    unArbol: {
      heading: "Un Árbol",
      body: "Un Árbol restaura bosques nativos en Argentina desde hace más de 15 años. Son ellos los que convirtieron la fiesta del 28 de marzo en árboles reales, y son ellos los que eligen dónde y cuándo plantarlos a lo largo del país. El 19 nos reciben en la reserva para plantar una parte juntos, el resto lo siguen haciendo ellos con su criterio y su calendario. Vos ponés las manos. Ellos ponen los 15 años de saber dónde, cómo y qué.",
      partnerLabel: "EN COLABORACIÓN CON",
    },
    logistics: {
      heading: "Lo que necesitás saber",
      items: [
        "Reserva natural en zona San Miguel / Bella Vista (~1h de Capital por Acceso Norte)",
        "La dirección exacta y el link a Google Maps se mandan por email al anotarte",
        "Tren San Martín hasta Bella Vista + corto traslado",
        "Armamos carpools desde Capital — marcalo en el form",
      ],
      faqHeading: "Preguntas frecuentes",
      faq: [
        {
          q: "¿Es gratis?",
          a: "Sí, totalmente gratis. Pero requiere que te anotes antes — son 40 lugares y la dirección exacta la mandamos por email solo a quienes están en la lista.",
        },
        {
          q: "¿Qué llevo?",
          a: "Ropa que no te importe ensuciar, zapatillas cerradas, gorra, agua. Si tenés guantes de jardín, mejor.",
        },
        {
          q: "¿Cuántos árboles vamos a plantar ese día?",
          a: "Una parte simbólica, con tiempo y atención. El resto los planta Un Árbol por todo el país cuando y donde corresponda — ese es su trabajo y lo hacen mejor que nadie.",
        },
        {
          q: "¿Hay comida?",
          a: "Sí, hay food trucks en la reserva. Llevá plata o tarjeta si querés comer algo.",
        },
        {
          q: "¿Llueve?",
          a: "Si el pronóstico es feo, reprogramamos y te avisamos por mail con 24h de anticipación. Por eso importa que estés anotado.",
        },
        {
          q: "¿Puedo ir con mi hijo/a?",
          a: "Sí, desde los 8 años. Los más chicos plantan mejor que nosotros. Anotalos como \"con alguien\" en el form.",
        },
        {
          q: "¿Cuánto dura?",
          a: "De 14 a 17h. Plantamos un rato, meditamos, comemos algo, nos quedamos charlando. No es jornada de trabajo — es tarde de domingo.",
        },
        {
          q: "¿Hay baños y agua?",
          a: "Sí, en la reserva.",
        },
      ],
    },
    registration: {
      heading: "Anotate para plantar",
      subtitle: "Gratis, pero con cupo. Quedan {remaining} de 40 lugares.",
      subtitleFull: "Se llenaron los 40 lugares. Dejá tu mail para la lista de espera.",
      helper: "Dejanos tu nombre y email. Te mandamos la dirección exacta, el horario y todo lo que necesitás saber.",
      namePlaceholder: "Tu nombre",
      emailPlaceholder: "Tu email",
      groupLabel: "¿Venís solo o con alguien?",
      groupSolo: "Solo",
      groupWithSomeone: "Con alguien",
      groupGroup: "Con un grupo (3+)",
      carpoolLabel: "Puedo ofrecer lugar en mi auto desde Capital",
      messageLabel: "Dejá un mensaje para cebar a la próxima persona que venga a anotarse (opcional)",
      messagePlaceholder: "Ej: Vení a plantar conmigo, es gratis y va a estar hermoso 🌱",
      cta: "Vengo el 19 🌱",
      submitting: "Reservando...",
      successHeading: "Listo.",
      successMessage: "Te mandamos la dirección exacta y los detalles por mail. Nos vemos el 19 con las manos listas.",
      alreadyRegistered: "Ya estabas en la lista. Revisá tu mail para los detalles.",
      errorMessage: "Algo salió mal. Intentá de nuevo.",
      shareButton: "Compartir en stories",
      shareDownload: "Descargar imagen",
      sharePrompt: "Subilo a tu story y ayudanos a seguir hyppeando 🌱",
      waitlistHeading: "Lista de espera",
      waitlistSubtitle: "Se llenaron los 40 lugares. Dejá tu mail y te avisamos si se libera uno.",
      waitlistCta: "Anotarme en la lista",
      waitlistSuccess: "Listo, te avisamos si se libera un lugar.",
    },
    finalCta: {
      title: "40 lugares. Una tarde en la reserva.",
      subtitle: "Gratis. Pero necesitás estar en la lista para entrar.",
      cta: "Reservá tu pala 🌱",
    },
  },
};

export default es;
