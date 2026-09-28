/**
 * Desafío "15 días meditando" — the starting content for the 15 days.
 *
 * One guided meditation per day from Hari's YouTube playlist, plus a title
 * and a short text. This is a first draft, not the source of truth: once
 * `scripts/prefill-desafio.ts --execute` has loaded it, `challenge_days` is
 * what the landing renders and Hari edits it from /admin/desafio. The script
 * never overwrites a day that already has a row.
 *
 * Also feeds the preview fixtures in `scripts/seed-preview.ts`.
 * Pure data: safe to import anywhere.
 */

export interface DesafioPrefillDay {
  dayNumber: number;
  title: string;
  body: string;
  mediaUrl: string;
}

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const DESAFIO_PREFILL: readonly DesafioPrefillDay[] = [
  {
    dayNumber: 1,
    title: "Arrancar con la luna llena",
    body:
      "La luna llena del 26 de septiembre todavía está cerca, y es un buen momento para empezar algo nuevo. Hoy Gurudev te guía en una meditación que aprovecha esa energía de plenitud. Tu intención para estos 15 días: aparecer cada día, aunque sea un rato.",
    mediaUrl: yt("sq9Ug1hrqW4"),
  },
  {
    dayNumber: 2,
    title: "Empezar desde cero",
    body:
      "Una práctica simple, pensada para quienes recién empiezan y para quienes quieren volver a empezar. No hay nada que lograr: buscá una postura cómoda, cerrá los ojos y dejá que la voz te lleve.",
    mediaUrl: yt("UD87tGkyrs8"),
  },
  {
    dayNumber: 3,
    title: "Bajar las revoluciones",
    body:
      "La mente va rápido casi todo el día; hoy la práctica es darle un respiro. Si aparecen pensamientos, no pelees con ellos: dejalos pasar como nubes. Probá hacerla a la misma hora que ayer, así el hábito se va armando.",
    mediaUrl: yt("JmNFyuovHcM"),
  },
  {
    dayNumber: 4,
    title: "Mover el cuerpo, aquietar la mente",
    body:
      "Hoy empezamos moviendo el cuerpo para después quedarnos en silencio. Es más fácil soltar cuando el cuerpo ya se sacudió un poco la tensión del día. Hacela con ropa cómoda y algo de espacio a tu alrededor.",
    mediaUrl: yt("DBCvWqvv5xE"),
  },
  {
    dayNumber: 5,
    title: "Soltar el esfuerzo",
    body:
      "Gurudev dice que la meditación es el arte de no hacer nada. Hoy la invitación es esa: no intentar meditar bien, no forzar el silencio. Si te distraés, volvé con suavidad, sin retarte.",
    mediaUrl: yt("-v4W5O8R050"),
  },
  {
    dayNumber: 6,
    title: "Bhramari: la respiración que zumba",
    body:
      "Bhramari es una respiración en la que hacés un zumbido suave, como el de una abeja, con los oídos tapados. La vibración aquieta la mente muy rápido y viene bárbaro las noches en que cuesta dormir. Si al principio te da risa, no pasa nada: es parte.",
    mediaUrl: yt("J1MwcuRU0r8"),
  },
  {
    dayNumber: 7,
    title: "Aflojar el estrés",
    body:
      "Llegaste a la primera semana. Hoy la práctica apunta a aflojar el estrés y la ansiedad que se acumulan en el cuerpo. Antes de empezar, fijate dónde sentís tensión (mandíbula, hombros, panza) y volvé a mirar ese lugar al terminar.",
    mediaUrl: yt("nO230QHoiU8"),
  },
  {
    dayNumber: 8,
    title: "Cuando la mente no para de hablar",
    body:
      "Esa voz que comenta todo, planifica y repasa conversaciones: hoy le bajamos el volumen. No se trata de callarla a la fuerza, sino de dejar de seguirla. Cada vez que te das cuenta de que te fuiste, eso ya es meditar.",
    mediaUrl: yt("QrMjjBRNo7c"),
  },
  {
    dayNumber: 9,
    title: "Cargar las pilas",
    body:
      "Una meditación para renovar la energía y terminar con más ganas que las que tenías al empezar. Si podés, hacela a la mañana y fijate cómo cambia el resto de tu día.",
    mediaUrl: yt("VkFW5qbm3GM"),
  },
  {
    dayNumber: 10,
    title: "Mirar sin apuro",
    body:
      "Hoy la práctica es distinta: meditamos con los ojos abiertos. Es un puente entre el silencio de la meditación y la vida cotidiana. Elegí un punto donde apoyar la mirada y dejá que se vuelva suave.",
    mediaUrl: yt("0D-V5eyai78"),
  },
  {
    dayNumber: 11,
    title: "Abrir el corazón",
    body:
      "Gurudev te guía hacia el centro del pecho, donde vive Anahata, el chakra del corazón. La intención de hoy es suavizar algo que venías cargando: un enojo, una distancia, una exigencia con vos. Si te sale, al terminar mandale un mensaje lindo a alguien.",
    mediaUrl: yt("9eSGEq9gZkk"),
  },
  {
    dayNumber: 12,
    title: "Del ruido a la claridad",
    body:
      "Partimos del sonido y lo dejamos apagarse hasta quedar en silencio. En ese espacio muchas veces aparece la claridad que no encontrás pensando. Si tenés una decisión dando vueltas, llevala a la práctica sin buscar respuesta y fijate qué queda después.",
    mediaUrl: yt("03dAIpAdTA8"),
  },
  {
    dayNumber: 13,
    title: "La alegría como práctica",
    body:
      "Gurudev dice que la alegría es nuestra naturaleza, no algo que haya que salir a buscar. Hoy meditamos para reconectar con eso. Al final, anotá una cosa chiquita que te haya hecho sonreír hoy.",
    mediaUrl: yt("kzK21NIrAdY"),
  },
  {
    dayNumber: 14,
    title: "Más grande que el cuerpo",
    body:
      "Una meditación para expandir la conciencia más allá del cuerpo y de los problemas de siempre. A veces lo que parece enorme se achica cuando por dentro nos hacemos más grandes. Mañana es el último día: preparate para cerrar.",
    mediaUrl: yt("G90fqasBSlE"),
  },
  {
    dayNumber: 15,
    title: "Cerrar con gratitud",
    body:
      "Día 15: lo lograste. Cerramos el recorrido con una meditación de Gurudev sobre la gracia, esa lluvia suave que llega cuando dejamos de empujar. Tomate un momento para agradecerte el camino y celebrar a quienes practicaron a la par: la práctica sigue, a tu ritmo.",
    mediaUrl: yt("lYAb6LHu3tg"),
  },
];
