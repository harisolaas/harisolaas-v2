import type { Dictionary } from "./types";

const es: Dictionary = {
  metadata: {
    title: "Harald Solaas \u2014 Tecnolog\u00eda al servicio de las personas",
    description:
      "Ingeniero de Software Senior y Consultor Tecnol\u00f3gico. Una d\u00e9cada de resultados medibles \u2014 un ecommerce de USD 21M reconstruido, plataformas moviendo 200+ tiendas globales \u2014 construyendo tecnolog\u00eda al servicio de las personas.",
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
      "Ingeniero de Software Senior y Consultor Tecnol\u00f3gico. Una d\u00e9cada de resultados medibles, construyendo tecnolog\u00eda al servicio de las personas.",
    twitterTitle:
      "Harald Solaas \u2014 Tecnolog\u00eda al servicio de las personas",
    twitterDescription:
      "Ingeniero de Software Senior y Consultor Tecnol\u00f3gico. Construyo tecnolog\u00eda al servicio de las personas.",
  },
  nav: {
    brand: "Hari",
    impact: "Resultados",
    values: "Valores",
    now: "Ahora",
    story: "Recorrido",
    contact: "Contacto",
    toggleMenu: "Abrir men\u00fa",
  },
  hero: {
    name: "Harald Solaas",
    tagline:
      "Empec\u00e9 a meditar a los 15, a ense\u00f1ar a los 16 y a programar a los 20. No dej\u00e9 de hacer ninguna.",
    positioning:
      "Ayudo a empresas a construir productos que perduran \u2014 hoy tomando proyectos de consultor\u00eda.",
    ctaLabel: "Construyamos algo",
    scrollCta: "Scrolle\u00e1 para conocerme",
    photoAlt: "Harald Solaas",
    metaRole: "Ingeniero de software senior \u00b7 Consultor tecnol\u00f3gico",
    metaLocation: "Buenos Aires, Argentina",
    photoCaption: "fig. 01 \u2014 el humano",
  },
  impact: {
    heading: "Resultados",
    items: [
      {
        label: "Carewell",
        title: "Una reconstrucción de USD 21M que rindió el primer mes",
        description:
          "Cuatro ingenieros reconstruimos el ecommerce de salud de Carewell desde cero. Lanzamos a tiempo, el engagement y las ventas subieron el primer mes, y el sitio funciona incluso sin JavaScript — una exigencia del directorio llena de problemas que nadie en la industria había resuelto antes.",
        metrics: [
          { value: "$21M", label: "Plataforma reconstruida" },
          { value: "100", label: "Performance en Lighthouse" },
        ],
      },
      {
        label: "Cruise",
        title: "De apagar incendios a un año de calma",
        description:
          "La plataforma de análisis que usaban ejecutivos y operaciones se caía 14 veces por mes. Cambié cómo testeaba el equipo — casos de uso reales por sobre números de cobertura —, entrené a mis colegas, y corrió un año entero casi sin caídas. Esa infraestructura sigue siendo la base del equipo.",
        metrics: [
          { value: "14→0.3", label: "Caídas por mes" },
          { value: "90%", label: "Menos tiempo de ejecución" },
        ],
      },
      {
        label: "Estée Lauder",
        title: "Un sistema, 200+ tiendas",
        description:
          "Un solo sistema de componentes moviendo el ecommerce de 200+ sitios de marcas en todo el mundo. Cuando cientos de miles de personas compran por día, cada deploy importa — subimos la cobertura de tests de 60% a 85% y redujimos el tiempo a primera interacción.",
        metrics: [
          { value: "200+", label: "Sitios servidos" },
          { value: "60→85%", label: "Cobertura de tests" },
        ],
      },
      {
        label: "Industria legal · 2023–hoy",
        title: "Una plataforma que aguanta cuando llega la ola",
        description:
          "Una empresa legal de EE.UU. que maneja demandas masivas: cuando se abre un caso, el tráfico se dispara en horas. Migré su aplicación legacy a una plataforma server-rendered que se mantiene rápida, accesible y segura bajo presión — y mantiene su operación en línea.",
      },
    ],
  },
  values: [
    {
      id: "percentile",
      statement: "Voy por el \u00faltimo 1%.",
      proofPoints: [
        {
          label: "Carewell",
          title: "Un ecommerce que funciona sin JavaScript",
          description:
            "El CDO testeaba el sitio entero con JavaScript deshabilitado \u2014 nada pod\u00eda romperse. La mayor\u00eda de lo que eso exig\u00eda no ten\u00eda soluci\u00f3n documentada, as\u00ed que trabaj\u00e9 a base de pruebas de concepto: construir chico, validar con el equipo, incubar cada feature en un rinc\u00f3n del sitio y despu\u00e9s crecerla a todo el stack.",
        },
        {
          label: "Academia online",
          title: "Terminado significa medido",
          description:
            "En una plataforma educativa de alto tr\u00e1fico deploy\u00e1bamos progresivamente por niveles de usuarios. Una feature no estaba completa hasta que el 100% la hab\u00eda usado una semana \u2014 con datos confiables de su impacto.",
        },
        {
          label: "Delivery aumentado con IA",
          title: "Tres reviews antes de que lo lea un humano",
          description:
            "Construyo mis propias herramientas: cada pull request que abro lo revisan dos modelos de IA, se fusionan en un solo review y un tercer agente lo poda antes de que yo lo lea. El \u00faltimo 1% incluye c\u00f3mo se hace el trabajo mismo.",
        },
      ],
      quote: {
        text: "No dejar nada para despu\u00e9s. Ir hasta el \u00faltimo 1% de hacer que la experiencia del usuario sea incre\u00edble. Optimizar tanto como tenga sentido, tanto como agregue valor.",
      },
      photoAlt: "Excelencia t\u00e9cnica y precisi\u00f3n",
      photoSrc: "/excellence.jpg",
      photoPosition: "80% center",
      variant: "forest",
    },
    {
      id: "outlive",
      statement: "Construyo cosas que me trascienden.",
      proofPoints: [
        {
          label: "Cruise",
          title: "Infraestructura de testing que se volvi\u00f3 la base",
          description:
            "En Cruise (veh\u00edculos aut\u00f3nomos, Silicon Valley) no solo fren\u00e9 las ca\u00eddas \u2014 cambi\u00e9 c\u00f3mo testeaba el equipo y entren\u00e9 a los ingenieros a mi alrededor. A\u00f1os despu\u00e9s, la infraestructura de testing que constru\u00ed sigue siendo lo que sostiene al equipo.",
        },
        {
          label: "Est\u00e9e Lauder",
          title: "Componentes que me sobrevivieron",
          description:
            "El sistema de componentes que ayud\u00e9 a construir sigue moviendo 200+ tiendas de marcas mucho despu\u00e9s de mi paso. El c\u00f3digo que dura es c\u00f3digo que se pens\u00f3 bien.",
        },
        {
          label: "Comunidad",
          title: "Un programa que sigue sin m\u00ed",
          description:
            "Lider\u00e9, junto a un equipo, a 50 voluntarios para ense\u00f1ar a m\u00e1s de 500 personas en una villa de Buenos Aires. Constru\u00ed la infraestructura de voluntarios y despu\u00e9s migr\u00e9 al pr\u00f3ximo desaf\u00edo. El programa contin\u00faa hasta el d\u00eda de hoy.",
        },
      ],
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
            "A los 16, me convert\u00ed en el profesor de alivio de trauma m\u00e1s joven de El Arte de Vivir en Latinoam\u00e9rica. Trabaj\u00e9 con personas que perdieron sus hogares en Villa La Angostura. Trabaj\u00e9 con hu\u00e9rfanos, j\u00f3venes en rehabilitaci\u00f3n y en procesos judiciales. Aprend\u00ed que detr\u00e1s de cada exterior dif\u00edcil, hay una historia y hay amor.",
        },
        {
          label: "Profesional",
          title: "El puente entre la ingenier\u00eda y las personas",
          description:
            "En Carewell, reconstru\u00ed una plataforma de salud para que familiares agotados que cuidan de adultos mayores puedan encontrar lo que necesitan m\u00e1s r\u00e1pido. En Est\u00e9e Lauder, una librer\u00eda de componentes React sirviendo 200+ sitios de ecommerce no se trataba de c\u00f3digo \u2014 se trataba de la persona del otro lado intentando comprar un producto. En cada empresa, termin\u00e9 siendo el puente entre ingenier\u00eda y producto \u2014 porque veo a las personas, no solo el c\u00f3digo.",
        },
      ],
      variant: "tan",
    },
  ],
  beyond: {
    heading: "Más allá del código",
    subheading: "Los mismos principios, lejos de la pantalla.",
    items: [
      {
        label: "Enseñanza",
        title: "Charlas y docencia en bienestar",
        description:
          "Profesor certificado de El Arte de Vivir desde 2022. Doy charlas sobre hábitos, meditación y liderazgo consciente en eventos de bienestar, y facilito un encuentro semanal de meditación y escritura en Buenos Aires.",
      },
      {
        label: "Servicio",
        title: "Otra manera de crecer",
        description:
          "Tres años enseñando a adolescentes en una villa de Buenos Aires — técnicas de respiración, valores humanos, cómo volver a jugar. Ayudando a que dejen el crimen atrás y vean que existe otro camino.",
      },
      {
        label: "Práctica",
        title: "9 años de práctica diaria",
        description:
          "Sudarshan Kriya y meditación, todos los días desde hace 9 años. La alegría no es accidental — es una disciplina.",
      },
    ],
    photoAlt: "Hari dando una charla en un evento de bienestar",
  },
  now: {
    heading: "Lo que estoy armando ahora",
    subheading:
      "Siempre estoy construyendo algo \u2014 en c\u00f3digo, en comunidad o en m\u00ed mismo. Esto es en lo que estoy trabajando estos d\u00edas.",
    items: [
      {
        categoryKey: "teaching",
        categoryLabel: "Ense\u00f1anza",
        title: "Mentor\u00eda 1 a 1",
        description:
          "Acompa\u00f1amiento individual con encuentros semanales, en ciclos de tres meses. Un proceso a medida, con las herramientas que uso conmigo mismo.",
        status: "Sucediendo ahora",
        cta: {
          label: "Conoc\u00e9 m\u00e1s",
          href: "/es/mentoria",
        },
      },
      {
        categoryKey: "teaching",
        categoryLabel: "Ense\u00f1anza",
        title: "Sinergia \u2014 Meditaci\u00f3n y lectura/escritura",
        description:
          "Encuentro semanal los mi\u00e9rcoles a las 19:30 en Palermo. Meditaci\u00f3n, un rato con un libro o una hoja en blanco, y una cena opcional para quedarte. A colaboraci\u00f3n, sin experiencia previa.",
        status: "Cada mi\u00e9rcoles",
        cta: {
          label: "Reserv\u00e1 tu lugar",
          href: "/es/sinergia",
        },
      },
      {
        categoryKey: "building",
        categoryLabel: "Desarrollo",
        title: "Socio tecnol\u00f3gico y de IA para negocios",
        description:
          "Ayudo a empresas a llevar sus operaciones al mundo digital \u2014 desde automatizaci\u00f3n con IA hasta productos completos. Lo \u00faltimo: una plataforma de entradas y pagos para un evento comunitario \u2014 checkout de MercadoPago, tickets QR validados en la puerta, emails autom\u00e1ticos \u2014 construida de punta a punta. Si necesit\u00e1s un socio que entienda tanto la tecnolog\u00eda como el negocio, hablemos.",
        status: "Sucediendo ahora",
        cta: { label: "Contactame", href: "mailto:dev@harisolaas.com" },
      },
      {
        categoryKey: "personal",
        categoryLabel: "Personal",
        title: "Segu\u00ed mis aventuras",
        description:
          "Mantengo la aventura, el arte y los desaf\u00edos f\u00edsicos como parte de mi d\u00eda a d\u00eda. Seguime en Instagram.",
        status: "En curso",
        cta: {
          label: "Seguime en Instagram",
          href: "https://instagram.com/harisolaas",
        },
      },
      {
        categoryKey: "community",
        categoryLabel: "Comunidad",
        title: "BROTE \u2014 100 \u00e1rboles plantados",
        description:
          "Cerramos el ciclo de BROTE: una fiesta de reforestaci\u00f3n donde cada entrada plant\u00f3 un \u00e1rbol, y una plantaci\u00f3n de cierre con Un \u00c1rbol en una reserva de San Miguel \u2014 \u00e9ramos ~30 con palas en mano. 100 \u00e1rboles nativos en total.",
        status: "Ciclo cerrado \u00b7 Abril 2026",
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
          "Empec\u00e9 a meditar a los 15; a los 16 me convert\u00ed en el profesor de alivio de trauma m\u00e1s joven de El Arte de Vivir en Latinoam\u00e9rica.",
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
      "Trabajo como consultor tecnol\u00f3gico senior \u2014 ayudo a empresas a construir los productos correctos con las tecnolog\u00edas correctas, incluyendo IA que genuinamente sirva a tu equipo y a tus usuarios. La consultor\u00eda es mi formato habitual, y estoy abierto al rol full-time indicado. Si quer\u00e9s un ingeniero que se preocupe por tu problema tanto como vos, hablemos.",
    caseStudyLabel: "Leer el caso de estudio de Carewell en Toptal",
    linkLabels: {
      email: "Email",
      linkedin: "LinkedIn",
      toptal: "Toptal",
      instagram: "Instagram",
    },
    copyEmail: "copiar email",
    copiedEmail: "copiado ✓",
  },
  footer: {
    copyright: "Harald Solaas \u2014 harisolaas.com",
    buildLine: "hecho a mano con next.js \u00b7 sin plantillas",
  },
  brote: {
    meta: {
      title: "BROTE \u2014 Fiesta de reforestaci\u00f3n",
      description:
        "M\u00fasica en vivo, catering y una noche con sentido. Cada entrada planta un \u00e1rbol real en Argentina. Jueves 20 de agosto.",
      ogDescription:
        "M\u00fasica en vivo, catering y una noche con sentido. Cada entrada planta un \u00e1rbol real en Argentina.",
      ogImageAlt:
        "BROTE \u2014 una entrada, un \u00e1rbol. Jueves 20 de agosto, 19:00 a 22:30, Palermo, CABA.",
    },
    topbar: { left: "Fiesta", right: "2026" },
    hero: {
      cta: "Quiero mi entrada",
      textureAlt: "Texturas de anillos de árbol y venas de hoja",
    },
    infoBar: {
      date: { label: "Agosto", value: "20" },
      time: { label: "Horario", value: "19–22:30" },
      place: { label: "Palermo", value: "CABA" },
    },
    eyebrows: {
      lineup: "Line up",
      pricing: "Entradas",
    },
    lineup: {
      timeRange: "19:00 \u2192 22:30",
      welcome: {
        number: "01",
        time: "19:00 \u00b7 Llegada",
        title: "\u00bfNo sab\u00e9s con qui\u00e9n venir?",
        kicker: "Ven\u00ed igual. Estamos nosotros.",
        body1:
          "Arrancamos tranqui: algo para comer, algo para tomar y una hora entera para conocerse. Los que organizamos esto estamos en la puerta y adentro, charlando con todo el mundo \u2014 si ven\u00eds solo/a, te presentamos gente.",
        body2:
          "Tambi\u00e9n van a estar las marcas con prop\u00f3sito que nos acompa\u00f1an, para que las conozcas de cerca.",
      },
      live: {
        number: "02",
        time: "20:00 \u00b7 En vivo",
        title: "M\u00fasica ac\u00fastica\nen vivo",
        photoAlt:
          "Set ac\u00fastico en vivo en una edici\u00f3n anterior de BROTE",
        mention: {
          bodyBefore: "Toca ",
          slug: "jose",
          bodyAfter:
            ", guitarra y voz, sin nada en el medio. No hay mucho m\u00e1s para explicar: se escucha.",
        },
      },
      dj: {
        number: "03",
        time: "21:15 \u00b7 Cierre",
        title: "DJ set",
        mention: {
          bodyBefore: "Recibimos a ",
          slug: "gian",
          bodyAfter:
            " para una intervenci\u00f3n de baile performativo que marca el pulso hasta el cierre.",
        },
      },
    },
    impact: {
      counterLabel: "\u00c1rboles plantados hasta hoy",
    },
    pricing: {
      earlyBirdLabel: "Preventa",
      earlyBirdBadge: "-25%",
      earlyBirdExpired: "Preventa finalizada",
      earlyBirdUntil: "Hasta el 13 de agosto",
      earlyBirdClosed: "Cerr\u00f3 el 13 de agosto",
      savingsLine: "Es el precio de hoy. Ahorr\u00e1s {savings} sobre el general.",
      includesLink: "\u00bfQu\u00e9 incluye tu entrada?",
      generalNote: "Desde el 14 de agosto pasa a {price}, hasta agotar.",
      payment: "Pag\u00e1s con MercadoPago / tarjeta / transferencia.",
    },
    includes: {
      eyebrow: "\u00bfQu\u00e9 incluye tu entrada?",
      items: [
        {
          number: "01",
          title: "Un \u00e1rbol a tu nombre",
          mention: {
            bodyBefore: "Plantado en Argentina junto a ",
            slug: "unarbol",
            bodyAfter: ". Real, en un lugar real.",
          },
        },
        {
          number: "02",
          title: "Una bebida MateLab",
          mention: {
            bodyBefore: "Nos la trae ",
            slug: "matelab",
            bodyAfter: ". Fr\u00eda, esper\u00e1ndote apenas lleg\u00e1s.",
          },
        },
        {
          number: "03",
          title: "El show",
          body: "M\u00fasica ac\u00fastica en vivo y DJ set, de punta a punta.",
        },
      ],
      featured: {
        number: "04",
        title: "Un brote para llevarte a casa",
        body: "Lo sembramos juntos esa misma noche. Te lo llev\u00e1s, lo plant\u00e1s donde vivas y sigue creciendo cuando la fiesta ya pas\u00f3.",
      },
    },
    community: {
      intro: {
        before: "Esto nace de ",
        sponsors: "El Arte de Vivir",
        after:
          ", una comunidad que practica respiraci\u00f3n, yoga y servicio en m\u00e1s de 180 pa\u00edses del mundo.",
      },
      body: "No organizamos eventos: creamos experiencias donde lo que hac\u00e9s por afuera refleja lo que cultiv\u00e1s por dentro.",
      tagline: "Esta fiesta es para todo el mundo \u00b7 Ven\u00ed como sos",
      sponsorsRow: { eyebrow: "Nos acompa\u00f1an" },
    },
    final: {
      heading: "\u00bfVen\u00eds?",
      compactDate: "Jue 20 Ago",
      compactTime: "19:00\u201322:30",
      address: "Costa Rica 5644",
      cta: "Quiero mi entrada",
      plantingPrompt: "\u00bfNo pod\u00e9s venir?",
      plantingCta: "Sumate a la plantaci\u00f3n \u2192",
    },
    footer: {
      left: "Brote",
      right: {
        bodyBefore: "En alianza con ",
        slug: "unarbol",
        bodyAfter: "",
      },
    },
    checkoutError:
      "No pudimos abrir el pago. Prob\u00e1 de nuevo en un momento, o escribinos por WhatsApp.",
    success: {
      title: "BROTE \u2014 \u00a1Listo!",
      heading: "\u00a1Ya sos parte del bosque!",
      body: "Gracias a vos, un \u00e1rbol nuevo va a echar ra\u00edces en Argentina. Eso es real, y es gracias a tu decisi\u00f3n de hoy. Nos vemos el 20 de agosto para celebrarlo juntos.",
      emailNote:
        "Tu entrada con el c\u00f3digo QR va a llegar al email que usaste en MercadoPago en los pr\u00f3ximos minutos. Revis\u00e1 tu bandeja de entrada y spam.",
      noEmail: "\u00bfNo te lleg\u00f3 el email? Escribime y lo resolvemos.",
      whatsappCta: "Escribime por WhatsApp",
      backLink: "Volver a BROTE",
      pending: {
        heading: "Tu pago est\u00e1 en camino",
        body: "Elegiste un medio de pago que tarda un rato en acreditarse. Apenas se confirme, te llega la entrada con el QR \u2014 puede tardar hasta un par de d\u00edas si pagaste en efectivo.",
        emailNote:
          "Te la mandamos al mail de tu cuenta de MercadoPago. Si quer\u00e9s recibirla en otro, dejanos los datos ac\u00e1 abajo y la mandamos ah\u00ed.",
      },
      contact: {
        heading: "\u00bfD\u00f3nde quer\u00e9s recibir la entrada?",
        intro:
          "Te la mandamos al mail de tu cuenta de MercadoPago. Si prefer\u00eds recibirla en otro, confirmalo ac\u00e1 y te la reenviamos \u2014 el QR es el mismo.",
        optionalNote:
          "Es opcional. Si te queda bien el mail de MercadoPago, ya est\u00e1: no hace falta que hagas nada.",
        nameLabel: "Tu nombre",
        emailLabel: "Email",
        emailHelper: "Ac\u00e1 te llega la entrada con el QR.",
        phoneLabel: "WhatsApp",
        phonePlaceholder: "+54 9 11 2255 5110",
        phoneHelper:
          "Solo para escribirte el d\u00eda del evento si pasa algo \u2014 un cambio de horario, una urgencia.",
        submit: "Confirmar",
        submitting: "Confirmando\u2026",
        doneApplied:
          "Listo. Te reenviamos la entrada a ese mail \u2014 revis\u00e1 tambi\u00e9n el spam.",
        doneSaved:
          "Listo, guardamos tus datos. La entrada ya sali\u00f3 a ese mail: si no la ves, fijate en el spam o escribinos por WhatsApp.",
        donePending:
          "Listo, lo guardamos. Apenas se acredite el pago, la entrada sale a ese mail.",
        errors: {
          nameRequired: "Pon\u00e9 tu nombre.",
          emailInvalid: "Revis\u00e1 el email.",
          phoneInvalid: "Revis\u00e1 el n\u00famero de WhatsApp.",
          emailTaken:
            "Ese email ya tiene una entrada para BROTE. Us\u00e1 otro o escribinos por WhatsApp.",
          generic: "No pudimos guardarlo. Prob\u00e1 de nuevo en un momento.",
        },
      },
    },
    failure: {
      title: "BROTE \u2014 Pago no completado",
      heading: "El pago no se complet\u00f3",
      body: "Algo sali\u00f3 mal con el pago o fue cancelado. Pod\u00e9s intentar de nuevo desde la p\u00e1gina de BROTE.",
      backLink: "Volver a BROTE",
    },
  },
  broteInvitacion: {
    meta: {
      title: "BROTE — Invitación",
      description:
        "Una fiesta de reforestación en Palermo. Cada entrada planta un árbol real en Argentina, a tu nombre.",
    },
    rule: { left: "Invitación", right: "Brote 2026" },
    kicker: "Te invita",
    about: {
      wordmark: "Brote",
      paragraphs: [
        "Una fiesta de reforestación en Palermo. Cada entrada planta un árbol real en Argentina, a tu nombre.",
        "Música en vivo, gente linda y tierra bajo las manos. Una noche que sigue creciendo después.",
      ],
      facts: [
        { label: "Jueves", value: "20 AGO" },
        { label: "Desde", value: "19:00" },
        { label: "Palermo", value: "CABA" },
      ],
    },
    price: {
      invitedLabel: "Tu precio por invitación",
      ticketLabel: "Tu entrada",
      discountBadge: "-35%",
      earlyBirdBadge: "Preventa",
      noteDiscount: "Es el precio para quien llega por invitación. No está en la web.",
      noteEarlyBird: "Es el precio de preventa, hasta el 13 de agosto.",
      noteRegular: "Cada entrada planta un árbol real en Argentina, a tu nombre.",
      cta: "Quiero mi entrada",
      paymentMethods: "Con MercadoPago, tarjeta o transferencia",
      loading: "Un segundo…",
      error: "No pudimos abrir el pago. Probá de nuevo en un momento.",
    },
    includes: {
      eyebrow: "Tu entrada incluye",
      items: [
        {
          title: "Un árbol a tu nombre",
          description: "Plantado en Argentina junto a Un Árbol.",
        },
        {
          title: "Una bebida MateLab",
          description: "Fría, esperándote apenas llegás.",
        },
        {
          title: "El show",
          description: "Música acústica en vivo y DJ set, de punta a punta.",
        },
        {
          title: "Un brote para llevarte",
          description: "Lo sembramos juntos esa noche. Lo plantás donde vivas.",
        },
      ],
    },
    closing: { heading: "¿Venís?" },
    footer: { left: "Brote", right: "Con Un Árbol" },
    collaborators: {
      pulso: {
        roleLine: "Club de wellness. Nos acompañan en esta noche.",
        closingLine: "Pulso te guardó lugar. Nos vemos el 20.",
      },
      matelab: {
        roleLine:
          "La bebida que vas a tener en la mano toda la noche es de ellos.",
        closingLine: "MateLab te guardó lugar. Nos vemos el 20.",
      },
      unarbol: {
        roleLine: "Son quienes plantan cada árbol de BROTE, uno por entrada.",
        closingLine: "Un Árbol te guardó lugar. Nos vemos el 20.",
      },
      jose: {
        roleLine: "Toca en vivo esa noche: guitarra y voz, sin nada en el medio.",
        closingLine: "Jose te guardó lugar. Y toca para vos esa noche.",
      },
      gian: {
        roleLine: "Cierra la noche con su DJ set. Toca en vivo esa noche.",
        closingLine: "Gian te guardó lugar. Y cierra la noche para vos.",
      },
      comunidad: {
        // Nadie invita acá: la persona ya estuvo. El kicker compartido
        // ("Te invita") no aplica.
        kicker: "Sos parte de",
        roleLine:
          "Estuviste en la primera, o metiste las manos en la tierra. Esta es para vos.",
        closingLine: "Volvé. El bosque que empezaste sigue creciendo.",
      },
    },
  },
  plant: {
    meta: {
      title: "BROTE — El segundo movimiento",
      description:
        "El 19 de abril cerramos el ciclo de BROTE: meditación, plantación con Un Árbol y sobremesa en una reserva de San Miguel. Gratis, 40 lugares, requiere registración.",
      ogDescription:
        "El segundo movimiento de BROTE. Domingo 19 de abril en una reserva de San Miguel. Gratis con cupo limitado.",
    },
    hero: {
      eyebrow: "DOMINGO 19 DE ABRIL · DESDE LAS 14:30 · SAN MIGUEL",
      title: "El segundo movimiento de BROTE.",
      subtitle:
        "La fiesta plantó árboles en una planilla. El 19 nos encontramos a meter las manos en la tierra con Un Árbol.",
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
        description:
          "Vas a hacer un pozo, acomodar las raíces, apretar el suelo y dejar un árbol nativo en pie.",
      },
      {
        icon: "🧘",
        title: "Meditación guiada",
        description:
          "Antes de plantar, un rato sentados en silencio. Para llegar bien, para bajar el ruido de la ciudad y aparecer enteros frente a la tierra.",
      },
      {
        icon: "🌮",
        title: "Food trucks y sobremesa",
        description:
          "Hay food trucks en la reserva, música tranquila y lugar para quedarse. Venís a plantar, pero también a pasarla bien una tarde de domingo.",
      },
      {
        icon: "🌿",
        title: "Un Árbol te cuenta",
        description:
          "La ONG que viene restaurando bosques nativos hace 15 años. Vas a conocer su trabajo de primera mano y entender a dónde van los árboles que no plantamos ese día — Un Árbol los sigue plantando por todo el país cuando corresponde.",
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
          a: 'Sí, desde los 8 años. Los más chicos plantan mejor que nosotros. Anotalos como "con alguien" en el form.',
        },
        {
          q: "¿Cuánto dura?",
          a: "Arrancamos a las 14:30 y la reserva está abierta hasta las 19h. Te podés ir antes si querés — no es jornada de trabajo, es tarde de domingo. Plantamos, meditamos, comemos algo y nos quedamos charlando.",
        },
        {
          q: "¿Hay baños y agua?",
          a: "Sí, en la reserva.",
        },
      ],
    },
    messagesHeading: "Mensajes de aliento",
    registration: {
      heading: "Anotate para plantar",
      subtitle: "Gratis, pero con cupo. Quedan {remaining} de 40 lugares.",
      subtitleFull:
        "Se llenaron los 40 lugares. Dejá tu mail para la lista de espera.",
      helper:
        "Dejanos tu nombre y email. Te mandamos la dirección exacta, el horario y todo lo que necesitás saber.",
      namePlaceholder: "Tu nombre",
      emailPlaceholder: "Tu email",
      phonePlaceholder: "Tu WhatsApp (ej: 11 2255 5110)",
      phoneHelper: "Así te avisamos del punto de encuentro y cambios de último momento.",
      nameError: "Ingresá tu nombre",
      emailError: "Email inválido",
      phoneError: "Ingresá un WhatsApp válido (ej: 11 2255 5110)",
      groupLabel: "¿Venís por tu cuenta o con alguien?",
      groupSolo: "Por mi cuenta",
      groupWithSomeone: "Con alguien",
      groupGroup: "Con un grupo (3+)",
      carpoolLabel: "Puedo ofrecer lugar en mi auto desde Capital",
      messageLabel:
        "Dejá un mensaje para cebar a la próxima persona que venga a anotarse (opcional)",
      messagePlaceholder:
        "Ej: Vení a plantar conmigo, es gratis y va a estar hermoso 🌱",
      cta: "Voy el 19 🌱",
      submitting: "Reservando...",
      successHeading: "Listo.",
      successMessage:
        "Te mandamos la dirección exacta y los detalles por mail. Nos vemos el 19 con las manos listas.",
      alreadyRegistered:
        "Ya estabas en la lista. Revisá tu mail para los detalles.",
      errorMessage: "Algo salió mal. Intentá de nuevo.",
      shareButton: "Compartir en stories",
      shareDownload: "Descargar imagen",
      sharePrompt: "Subilo a tu story y ayudanos a seguir hyppeando 🌱",
      waitlistHeading: "Lista de espera",
      waitlistSubtitle:
        "Se llenaron los 40 lugares. Dejá tu mail y te avisamos si se libera uno.",
      waitlistCta: "Anotarme en la lista",
      waitlistSuccess: "Listo, te avisamos si se libera un lugar.",
    },
    finalCta: {
      title: "40 lugares. Una tarde en la reserva.",
      subtitle: "Gratis. Pero necesitás estar en la lista para entrar.",
      cta: "Reservá tu pala 🌱",
    },
  },

  sinergia: {
    meta: {
      title: "Sinergia — Una hora a la semana para volver a vos",
      description:
        "Taller semanal de meditación y lectura/escritura. Miércoles 19:30 en Palermo. A colaboración, sin experiencia previa.",
      ogDescription:
        "Una hora por semana, volvés a vos. 90 minutos de conexión y una mesa para quedarte si querés.",
    },
    hero: {
      eyebrow: "Taller de meditación y LECTURA/ESCRITURA",
      title: "Una hora a la semana para volver a vos.",
      subtitle:
        "Miércoles 19:30 en Palermo. A colaboración, sin experiencia previa.",
      cta: "Reservá tu lugar",
      seatsLabel: "Quedan {remaining} de {capacity} lugares",
      seatsFullLabel: "Cupo completo este miércoles",
    },
    what: {
      heading: "Qué es Sinergia",
      intro:
        "Noventa minutos de conexión, y una mesa para quedarte si querés. La cena es opcional.",
      schedule: [
        {
          time: "19:30",
          title: "Meditación y pranayama",
          description:
            "Arrancamos sintonizando todos en la misma frecuencia. Breathwork (técnicas de respiración), meditación guiada.",
        },
        {
          time: "20:00",
          title: "Lectura o escritura",
          description:
            "Un rato a solas con un texto, o con una hoja en blanco de tu elección. Si no sabés qué leer, tenemos una biblioteca llena de propuestas interesantes.",
        },
        {
          time: "20:30",
          title: "Compartimos y escuchamos",
          description: "Lo que apareció. Sin debate, sin obligación de hablar.",
        },
        {
          time: "21:00",
          title: "Cena libre",
          description: "Opcional. Comemos rico y casero.",
        },
      ],
    },
    hosts: {
      heading: "Lo sostenemos dos",
      hari: {
        name: "Hari",
        role: "Guía la práctica. Instructor de yoga y meditación en Sky Campus.",
      },
      coni: {
        name: "Coni",
        role: "Meditadora. Motor, soporte y guía del espacio lúdico.",
      },
      closing:
        "Sinergia vive dentro de Sky Campus, nuestra casa es en Palermo.",
    },
    frictions: {
      heading: "¿Cómo funciona?",
      items: [
        {
          title: "A colaboración",
          description: "Colaborás con lo que sientas.",
        },
        {
          title: "Sin experiencia previa",
          description:
            "Si nunca meditaste, no importa. Te acompañamos en el momento.",
        },
        {
          title: "Vení cuando puedas",
          description:
            "No es un curso. Venís un miércoles, o todos los miércoles. El espacio está.",
        },
      ],
    },
    rsvp: {
      heading: "Reservá tu espacio",
      subtitle:
        "Pedimos el lugar para asegurarnos de que haya un lugar para vos. Quedan {remaining} de {capacity}.",
      subtitleFull:
        "Se llenó el cupo de este miércoles. Volvé a intentar la semana que viene.",
      subtitleOverride:
        "Tenés una invitación para entrar aunque esté lleno. Anotate igual.",
      helper: "Te mandamos la dirección y cómo llegar por email.",
      namePlaceholder: "Tu nombre",
      emailPlaceholder: "Tu email",
      phonePlaceholder: "Tu WhatsApp (ej: 11 2255 5110)",
      phoneHelper: "Así te avisamos de cambios y coordinamos en el momento.",
      nameError: "Ingresá tu nombre",
      emailError: "Email inválido",
      phoneError: "Ingresá un WhatsApp válido (ej: 11 2255 5110)",
      dinnerError: "Elegí si te quedás a cenar",
      dinnerLabel: "¿Te quedás a cenar?",
      dinnerYes: "Sí, me quedo",
      dinnerNo: "No, solo la práctica",
      cta: "Reservar mi lugar",
      ctaWithDonation: "Reservar y aportar {amount}",
      submitting: "Reservando...",
      successHeading: "Listo.",
      successMessage:
        "Te mandamos la dirección y los detalles por mail. Nos vemos el miércoles.",
      alreadyRegistered:
        "Ya tenías tu lugar para este miércoles. Revisá tu mail.",
      errorMessage: "Algo salió mal. Intentá de nuevo.",
      micro: "Te escribimos a la dirección que dejes.",
      donation: {
        heading: "¿Querés sumar un aporte?",
        subtitle:
          "Sinergia es a colaboración. Lo que sumes ayuda a que podamos seguir abriendo la puerta cada miércoles.",
        chip5k: "$5.000",
        chip10k: "$10.000",
        chip20k: "$20.000",
        customChip: "Otro monto",
        customPlaceholder: "Monto en ARS",
        declineCheckbox: "Prefiero reservar sin aportar esta vez",
        chooseError:
          "Elegí un monto o marcá \"prefiero reservar sin aportar\".",
        minAmountError: "El mínimo es $1.000.",
      },
    },
    successPage: {
      title: "¡Gracias por tu aporte! — Sinergia",
      eyebrow: "Gracias",
      heading: "Gracias por sumar.",
      body: "Recibimos tu aporte. Lo que pongamos entre todos sostiene el espacio.",
      sessionLine: "Nos vemos {date} a las {time}.",
      addressLine: "{venue} · {address}",
      whatsappCta: "Escribinos por WhatsApp",
      backLink: "Volver a Sinergia",
    },
    failurePage: {
      title: "Pago no completado — Sinergia",
      heading: "El pago no se completó.",
      body: "Quedate tranqui: tu lugar sigue confirmado. Podés intentar el aporte de nuevo cuando quieras o simplemente venir.",
      rsvpStillConfirmed: "Tu reserva para el próximo miércoles está hecha.",
      retryCta: "Volver a intentar",
      whatsappCta: "Escribinos por WhatsApp",
      backLink: "Volver a Sinergia",
    },
    final: {
      heading: "Te esperamos el miércoles.",
      subtitle: "Un rato por semana que es solo tuyo.",
      cta: "Reservá tu lugar",
    },
  },
  sinergiaParrafo: {
    meta: {
      title: "Sinergia × Párrafo — Meditación, lectura y almuerzo",
      description:
        "Sábado 16 de mayo, 10 a 16 hs. Meditación, lectura y un almuerzo compartido. Una colaboración entre Sinergia y el club de lectura Párrafo. Cupo 50.",
      ogDescription:
        "Un día para bajar el ritmo, leer en compañía y compartir mesa. Sinergia × Párrafo — 16/05.",
    },
    hero: {
      eyebrow: "Sinergia × Párrafo",
      title: "Un día para meditar, leer y compartir mesa.",
      subtitle:
        "Una colaboración entre Sinergia y el club de lectura Párrafo. Llegás con un libro, te vas con tiempo recuperado.",
      dateLine: "Sábado 16 de mayo · 10 a 16 hs · Palermo",
      cta: "Reservar mi lugar",
      seatsLabel: "Quedan {remaining} de {capacity} lugares",
      seatsFullLabel: "Cupo completo",
    },
    what: {
      heading: "Cómo es el día",
      intro:
        "Seis horas para soltar la velocidad de la semana. Empezamos en silencio, leemos, conversamos y nos quedamos a almorzar.",
      schedule: [
        {
          time: "10:00",
          title: "Bienvenida y meditación",
          description:
            "Llegada, té y una práctica guiada de meditación y respiración para aterrizar.",
        },
        {
          time: "11:00",
          title: "Primera ronda de lectura",
          description:
            "Un rato a solas con el libro que estés trayendo. Si no traés ninguno, tenemos una biblioteca con propuestas.",
        },
        {
          time: "12:30",
          title: "Conversación con Párrafo",
          description:
            "El club de lectura Párrafo abre una conversación a partir de un texto compartido. Sin debate, sin obligación de hablar.",
        },
        {
          time: "13:30",
          title: "Almuerzo compartido",
          description:
            "Comida casera incluida. La mesa larga es parte del encuentro — quedate todo el rato que quieras.",
        },
        {
          time: "15:00",
          title: "Lectura libre y cierre",
          description:
            "Una última ronda más suelta — leer, escribir o simplemente estar. Cerramos a las 16.",
        },
      ],
    },
    hosts: {
      heading: "Quiénes lo sostienen",
      sinergia: {
        name: "Sinergia",
        role: "El espacio semanal de meditación y lectura que abrimos en Sky Campus, Palermo.",
      },
      parrafo: {
        name: "Párrafo",
        role: "Club de lectura que junta gente alrededor de textos para leer y conversar sin solemnidad.",
      },
      closing:
        "Es la primera vez que armamos algo juntos. Quisimos hacerlo largo, tranquilo y con mesa.",
    },
    practical: {
      heading: "Lo que tenés que saber",
      items: [
        {
          title: "Cupo limitado",
          description: "50 lugares. La mesa nos pone el techo.",
        },
        {
          title: "Incluye almuerzo",
          description:
            "Comida casera, opciones vegetarianas. Si tenés alguna restricción avisanos al inscribirte.",
        },
        {
          title: "Traé un libro",
          description:
            "El que estés leyendo o el que quieras empezar. También tenemos biblioteca por si llegás con las manos vacías.",
        },
        {
          title: "Sin experiencia previa",
          description:
            "Si nunca meditaste, no importa. Te acompañamos en el momento.",
        },
      ],
    },
    rsvp: {
      heading: "Reservá tu lugar",
      subtitle:
        "Quedan {remaining} de {capacity} lugares. La entrada se confirma con el pago.",
      subtitleFull: "Se llenó el cupo. Escribinos por WhatsApp por la lista de espera.",
      helper:
        "Te llevamos a MercadoPago para confirmar. Aceptamos tarjeta, débito y dinero en cuenta.",
      namePlaceholder: "Tu nombre",
      emailPlaceholder: "Tu email",
      phonePlaceholder: "Tu WhatsApp (ej: 11 2255 5110)",
      phoneHelper:
        "Lo usamos para coordinar el día y avisarte si hay cualquier cambio.",
      nameError: "Ingresá tu nombre",
      emailError: "Email inválido",
      phoneError: "Ingresá un WhatsApp válido (ej: 11 2255 5110)",
      cta: "Pagar {amount} y reservar",
      submitting: "Preparando el pago...",
      redirecting: "Te llevamos a MercadoPago...",
      errorMessage: "Algo salió mal. Intentá de nuevo en un momento.",
      priceLine: "Entrada · {amount} ARS",
    },
    successPage: {
      title: "¡Lugar confirmado! — Sinergia × Párrafo",
      eyebrow: "Gracias",
      heading: "Tu lugar está reservado.",
      body: "Recibimos tu pago. Nos vemos el sábado 16 de mayo.",
      sessionLine: "Sábado 16 de mayo · 10 a 16 hs",
      addressLine: "{venue} · {address}",
      emailNote:
        "Te mandamos un email con tu entrada y los detalles. Si no la ves, revisá spam.",
      whatsappCta: "Escribinos por WhatsApp",
      backLink: "Volver",
    },
    failurePage: {
      title: "Pago no completado — Sinergia × Párrafo",
      heading: "El pago no se completó.",
      body: "No te preocupes — no quedó ningún cargo. Podés volver a intentarlo o escribirnos por WhatsApp si necesitás otra forma de pago.",
      retryCta: "Volver a intentar",
      whatsappCta: "Escribinos por WhatsApp",
      backLink: "Volver",
    },
    final: {
      heading: "Te esperamos el 16.",
      subtitle: "Un día largo, tranquilo y con mesa.",
      cta: "Reservar mi lugar",
    },
  },
  mentoria: {
    meta: {
      title: "Mentoría 1 a 1 — Harald Solaas",
      description:
        "Acompañamiento individual con encuentros semanales, en ciclos de tres meses. Un proceso que se arma a medida de cada persona.",
      ogDescription:
        "Acompañamiento individual con encuentros semanales, en ciclos de tres meses. Un proceso que se arma a medida de cada persona.",
    },
    hero: {
      eyebrow: "Mentoría 1 a 1",
      heading: "Acompañamiento individual, un encuentro por semana.",
      intro:
        "Encuentros semanales, uno a uno, en ciclos de tres meses. Un proceso que se arma a tu medida, con las herramientas que uso conmigo mismo hace más de quince años.",
    },
    // Testimonios de Cris (primer mentoreado) — fuentes: Sesión Cris 2026-07-22
    // y 2026-07-29. Publicación sujeta a su OK explícito antes del merge.
    testimonials: [
      {
        text: "Un gran cambio en mi vida, sin lugar a dudas: las prioridades y el orden donde tienen que ir.",
        name: "Cris",
        role: "emprendedor — tres meses de mentoría",
      },
      {
        text: "Fuiste la persona que necesitaba encontrar este año. Me hiciste reconectar con un montón de cosas.",
        name: "Cris",
      },
    ],
    sections: {
      forWho: {
        heading: "Para quién",
        paragraphs: [
          "Personas que emprenden y lideran algo real: un negocio, un equipo, un proyecto que les importa. Gente que ya demostró que puede trabajar duro, y ahora quiere que esa fuerza no le cueste la paz.",
          "No hace falta llegar con una crisis. Alcanza con no querer seguir eligiendo entre el negocio y la vida interior.",
        ],
        quote: "En el momento en que decís «ya entendí», tu alerta se cae.",
      },
      what: {
        heading: "Qué es",
        paragraphs: [
          "Acompañamiento individual, con encuentros semanales. Cada proceso se arma alrededor de quien lo vive — no vas a atravesar el programa de otra persona.",
          "Meditación, respiración, escritura, lecturas, prácticas concretas o una conversación honesta — lo que aparece en cada encuentro depende de lo que estés atravesando, no de un temario.",
        ],
        quote:
          "Las herramientas que aparecen no son un método: son las que llevo en mi propio cinturón, porque las uso conmigo mismo.",
      },
      how: {
        heading: "Cómo trabajamos",
        paragraphs: [
          "Un encuentro por semana, por videollamada o en persona en Buenos Aires. Entre encuentros, lo que haga falta: una práctica, una lectura, un mensaje a tiempo.",
          "Trabajamos en ciclos de tres meses — ese es el compromiso mínimo. Al cierre de cada ciclo decidimos si seguimos. Desde hace unos meses acompaño así, semana a semana, a una persona que emprende.",
        ],
        quote:
          "Ver lo que está debajo: las motivaciones ocultas, el nudo real bajo el síntoma. Esa es la materia prima de lo que hago como mentor.",
        imageAlt:
          "Hari dando una charla al aire libre frente a un grupo sentado, con luz natural.",
      },
      whyMe: {
        heading: "Por qué yo",
        paragraphs: [
          "Empecé a meditar a los 15 y a enseñar a los 16. Llevo una década como ingeniero de software senior — la mayor parte para empresas de Silicon Valley — y los mismos años enseñando meditación y acompañando procesos humanos. Nunca elegí entre las dos vidas: aprendí a que se alimenten entre sí.",
          "Eso es lo que ofrezco: alguien que conoce por dentro la presión de construir — los números, los equipos, la ambición — y que sostiene hace años las prácticas que evitan que esa presión te coma.",
        ],
        quote:
          "La idea cambia, y la práctica tiene que atravesar eso. Esa es la disciplina.",
        imageAlt: "Retrato de Hari Solaas, con luz natural.",
      },
    },
    practical: {
      heading: "Lo práctico",
      items: [
        {
          label: "Formato",
          value: "Encuentros 1 a 1, por videollamada o en persona (Buenos Aires)",
        },
        {
          label: "Frecuencia",
          value: "Semanal, con acompañamiento entre encuentros",
        },
        {
          label: "Compromiso",
          value: "Ciclos de tres meses",
        },
      ],
      note: "Empezamos con una conversación. Si no soy la persona indicada para acompañarte, te lo digo yo.",
    },
    cta: {
      heading: "Empecemos con una conversación",
      body: "Escribime y contame en qué estás. Sin compromiso y sin guion: una charla para ver si esto es para vos.",
      buttonLabel: "Escribime por WhatsApp",
      // CTA destination: WhatsApp por convención del sitio. Swappable — el
      // destino definitivo del CTA es una decisión abierta del owner.
      href: "https://wa.me/5491122555110?text=Hola%21%20Quiero%20saber%20m%C3%A1s%20sobre%20la%20mentor%C3%ADa%201%20a%201",
    },
  },
};

export default es;
