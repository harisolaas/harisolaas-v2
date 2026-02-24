import type { Dictionary } from "./types";

const es: Dictionary = {
  metadata: {
    title: "Harald Solaas \u2014 Tecnolog\u00eda al servicio de las personas",
    description:
      "Ingeniero de Software Senior y Consultor Tecnol\u00f3gico. Construyo tecnolog\u00eda al servicio de las personas \u2014 y comunidades que me trasciendan.",
    keywords: [
      "Harald Solaas",
      "Hari Solaas",
      "Ingeniero de Software Senior",
      "Consultor Tecnol\u00f3gico",
      "React",
      "Next.js",
      "Desarrollador Full Stack",
    ],
    ogTitle: "Harald Solaas \u2014 Tecnolog\u00eda al servicio de las personas",
    ogDescription:
      "Ingeniero de Software Senior y Consultor Tecnol\u00f3gico. Construyo tecnolog\u00eda al servicio de las personas y comunidades que me trasciendan.",
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
      "Empec\u00e9 a meditar a los 15, a ense\u00f1ar a los 17 y a programar a los 20. No dej\u00e9 de hacer ninguna.",
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
            "Lider\u00e9 50 voluntarios para ense\u00f1ar a m\u00e1s de 500 personas en una villa de Buenos Aires. Constru\u00ed la infraestructura de voluntarios y despu\u00e9s me corr\u00ed. El programa continu\u00f3 2+ a\u00f1os sin m\u00ed.",
        },
        {
          label: "Personal",
          title: "Un equipo de b\u00e1squet desde cero",
          description:
            "Cre\u00e9 un equipo de b\u00e1squet a los 29 porque ya era grande para unirme a uno. Lo arm\u00e9 de la nada, jugu\u00e9 dos a\u00f1os y me fui por una lesi\u00f3n. El equipo sigui\u00f3 jugando dos a\u00f1os m\u00e1s.",
        },
        {
          label: "Profesional",
          title: "De 14 ca\u00eddas a casi cero",
          description:
            "En Cruise (veh\u00edculos aut\u00f3nomos, Silicon Valley), hered\u00e9 un codebase con 20% de cobertura de tests y 14 ca\u00eddas por mes. Lo dej\u00e9 en 70%+ de cobertura con 0.3 ca\u00eddas por mes. La infraestructura de testing que constru\u00ed se convirti\u00f3 en la base del equipo.",
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
          title: "Hijo de psic\u00f3logo",
          description:
            "Mi padre era psic\u00f3logo y consultor organizacional. Desde chico aprend\u00ed a ver los sistemas como conjuntos de personas \u2014 sus motivaciones, recompensas y sentido de pertenencia.",
        },
        {
          label: "Formativo",
          title:
            "El profesor de alivio de trauma m\u00e1s joven de Latinoam\u00e9rica",
          description:
            "A los 15, me convert\u00ed en el profesor de alivio de trauma m\u00e1s joven de El Arte de Vivir en Latinoam\u00e9rica. Trabaj\u00e9 con personas que perdieron sus hogares en Villa La Angostura. Trabaj\u00e9 con hu\u00e9rfanos, j\u00f3venes en riesgo y ex convictos. Aprend\u00ed que detr\u00e1s de cada exterior dif\u00edcil, hay una historia y hay amor.",
        },
        {
          label: "Profesional",
          title: "El puente entre ingenier\u00eda y las personas",
          description:
            "En Est\u00e9e Lauder, una librer\u00eda de componentes React sirviendo 200+ sitios de ecommerce no se trataba de c\u00f3digo \u2014 se trataba de la persona del otro lado intentando comprar un producto. En Carewell, reconstru\u00ed una plataforma de salud para que cuidadores de familia agotados pudieran encontrar lo que necesitan m\u00e1s r\u00e1pido. En cada empresa, termin\u00e9 siendo el puente entre ingenier\u00eda y producto \u2014 porque veo a las personas, no solo el c\u00f3digo.",
        },
      ],
      photoAlt: "Trabajando con j\u00f3venes en entornos comunitarios",
      photoSrc: "/working-with-youth.jpg",
      variant: "tan",
    },
    {
      id: "percentile",
      statement: "Voy al \u00faltimo percentil.",
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
            "Reconstru\u00ed una plataforma de ecommerce de salud de $21M con React, Next.js, Tailwind CSS y GraphQL. El sitio carga instant\u00e1neamente, funciona sin JavaScript, logra puntajes SEO excepcionales. Se lanz\u00f3 a tiempo con mayor engagement y ventas.",
          metrics: [
            { value: "$21M", label: "Plataforma reconstru\u00edda" },
            { value: "100", label: "Performance en Lighthouse" },
          ],
        },
        {
          label: "Est\u00e9e Lauder",
          title: "200+ sitios de marcas globales",
          description:
            "Constru\u00ed componentes flexibles y reutilizables sirviendo 200+ sitios de marcas a nivel global. Reduje el tiempo a primera interacci\u00f3n. Multi-tenancy al extremo \u2014 cada deploy importa cuando cientos de miles de usuarios dependen de \u00e9l diariamente.",
          metrics: [
            { value: "200+", label: "Sitios servidos" },
            { value: "60\u219285%", label: "Cobertura de tests" },
          ],
        },
      ],
      quote: {
        text: "No dejar nada para despu\u00e9s. Ir al primer percentil de hacer que la experiencia del usuario sea incre\u00edble. Optimizar tanto como tenga sentido, tanto como agregue valor.",
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
            "Constru\u00ed una plataforma de streaming para la fundaci\u00f3n con miles de usuarios mensuales, usando desaf\u00edos de video gamificados para profundizar el compromiso con contenido de meditaci\u00f3n y bienestar.",
        },
        {
          label: "Cruise",
          title: "Herramientas que construyen el futuro",
          description:
            "Constru\u00ed herramientas que ayudaron a ingenieros de autos, testers y cient\u00edficos de datos a visualizar cientos de miles de puntos de datos de conducciones aut\u00f3nomas. Construyendo las herramientas que construyen el futuro del transporte.",
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
      statement: "Traigo alegr\u00eda al trabajo.",
      proofPoints: [
        {
          label: "B\u00e1squet",
          title: "Muy grande para unirme, as\u00ed que arm\u00e9 uno",
          description:
            "Muy grande para unirme a un equipo a los 29, as\u00ed que cre\u00e9 uno. Me sum\u00e9 a una liga amateur. Se convirti\u00f3 en algo con vida propia.",
        },
        {
          label: "Ense\u00f1anza",
          title: "Tres a\u00f1os en una villa",
          description:
            "Ense\u00f1ando a adolescentes t\u00e9cnicas de respiraci\u00f3n, valores humanos, c\u00f3mo volver a ser chicos. Ayudando a adolescentes a salir del crimen. Mostrando que hay otro camino.",
        },
        {
          label: "Art of Living",
          title: "Profesor desde 2022",
          description:
            "Ense\u00f1ando cursos, construyendo comunidad en redes sociales, aprendiendo a vender con autenticidad, haciendo networking, construyendo grupos de voluntarios basados en \u00e9tica.",
        },
        {
          label: "Pr\u00e1ctica diaria",
          title: "8\u20139 a\u00f1os de pr\u00e1ctica diaria",
          description:
            "8\u20139 a\u00f1os de pr\u00e1ctica diaria de Sudarshan Kriya. La alegr\u00eda no es accidental \u2014 es una disciplina.",
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
    heading: "Lo que estoy construyendo ahora",
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
        cta: { label: "Ver pr\u00f3ximas fechas", href: "#contact" },
      },
      {
        categoryKey: "building",
        categoryLabel: "Desarrollo",
        title: "Socio tecnol\u00f3gico para negocios locales",
        description:
          "Actualmente ayudando a empresas argentinas a llevar sus operaciones al mundo digital \u2014 desde automatizaci\u00f3n hasta productos completos. Si necesit\u00e1s un socio tecnol\u00f3gico que entienda tanto la tecnolog\u00eda como el negocio, hablemos.",
        status: "En curso",
        cta: { label: "Contactame", href: "#contact" },
      },
      {
        categoryKey: "community",
        categoryLabel: "Comunidad",
        title: "Iniciativa de plantaci\u00f3n de \u00e1rboles",
        description:
          "Tradici\u00f3n anual de cumplea\u00f1os \u2014 plantar \u00e1rboles con la comunidad. Construyendo algo que nos va a trascender a todos.",
        status: "Anual",
        cta: { label: "Saber m\u00e1s", href: "#contact" },
      },
      {
        categoryKey: "teaching",
        categoryLabel: "Ense\u00f1anza",
        title: "Respiraci\u00f3n y valores humanos para j\u00f3venes",
        description:
          "Programas continuos trabajando con adolescentes y j\u00f3venes adultos en meditaci\u00f3n, resiliencia emocional y b\u00fasqueda de alternativas a la violencia y el crimen.",
        status: "En curso",
        cta: { label: "Ser voluntario", href: "#contact" },
      },
      {
        categoryKey: "personal",
        categoryLabel: "Personal",
        title: "Preparaci\u00f3n para temporada de surf",
        description:
          "Siguiendo un programa de entrenamiento de 8 semanas para estar listo para surfear y proteger las rodillas. Seguime en Instagram.",
        status: "En progreso",
        cta: {
          label: "Seguime en Instagram",
          href: "https://instagram.com",
        },
      },
    ],
  },
  timeline: {
    heading: "La historia completa",
    subheading: "Un arco compacto desde los 15 hasta hoy.",
    expand: "Expandir l\u00ednea de tiempo",
    collapse: "Contraer l\u00ednea de tiempo",
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
          "Apoyo comunitario post-desastre \u2014 trabajando con personas que perdieron sus hogares, hu\u00e9rfanos, j\u00f3venes en riesgo y ex convictos.",
        type: "community",
      },
      {
        year: "2014\u20132017",
        title: "Universidad de Belgrano",
        description:
          "Licenciatura en Administraci\u00f3n de Empresas. Empec\u00e9 a programar a los 20 por necesidad en concursos de emprendimiento.",
        type: "life",
      },
      {
        year: "2016\u2013Presente",
        title: "Ingeniero de Software Independiente",
        description:
          "Trabajo freelance \u2014 portfolios de artistas, sitios de fundaciones, plataformas de ecommerce. El comienzo de un oficio de por vida.",
        type: "work",
      },
      {
        year: "2016\u20132022",
        title: "Servicio comunitario",
        description:
          "Programas en villas con 50 voluntarios y 500+ participantes. Programa juvenil de f\u00fatbol de 3 a\u00f1os. Construcci\u00f3n de equipos de voluntarios.",
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
        description: "Reconectando con la herencia familiar.",
        type: "life",
      },
      {
        year: "2023\u2013Presente",
        title: "Consultor Senior",
        description:
          "Carewell (reconstrucci\u00f3n de ecommerce de salud de $21M), Colgate (asesor tecnol\u00f3gico), varios clientes. Evoluci\u00f3n de ingeniero a asesor de confianza.",
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
    ],
  },
  contact: {
    heading: "Construyamos algo.",
    description:
      "Trabajo como consultor tecnol\u00f3gico senior \u2014 ayudando a empresas a construir los productos correctos con las tecnolog\u00edas correctas. Traigo experiencia profunda en ingenier\u00eda, comunicaci\u00f3n humana y una mentalidad de servicio. Si quer\u00e9s un ingeniero que se preocupe por tu problema tanto como vos, hablemos.",
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
};

export default es;
