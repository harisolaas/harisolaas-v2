/**
 * Desafío "15 días meditando juntos" — the starting content for the 15 days.
 *
 * One guided meditation per day from Hari's YouTube playlist (Gurudev Sri Sri
 * Ravi Shankar, in Spanish), in the design's shape (`DesafioDayFields`). This
 * is a first draft, not the source of truth: once
 * `scripts/prefill-desafio.ts --execute` has loaded it, `challenge_days` is
 * what the page renders and Hari edits it from /admin/desafio.
 *
 * `meditacion` is a clean version of the YouTube title (no "Por Sri Sri…
 * traducido al español": the page shows Gurudev as a separate tag).
 * `duracion` is the real video length rounded to the minute, read from each
 * video's `lengthSeconds` on 2026-09-28. `introVideo` / `reflexionVideo`
 * start empty.
 *
 * Also feeds the preview fixtures in `scripts/seed-preview.ts`.
 * Pure data: safe to import anywhere.
 */
import type { DesafioDayFields } from "../lib/desafio";

export interface DesafioPrefillDay extends DesafioDayFields {
  dia: number;
}

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const DESAFIO_PREFILL: readonly DesafioPrefillDay[] = [
  {
    dia: 1,
    titulo: "Arrancar con la luna llena",
    intro:
      "La luna llena es un buen momento para empezar algo nuevo. Hoy Gurudev te guía en una meditación que aprovecha esa energía de plenitud. Tu intención para estos 15 días: aparecer cada día, aunque sea un rato.",
    introVideo: "",
    meditacion: "Meditación de la luna llena",
    meditacionVideo: yt("sq9Ug1hrqW4"),
    duracion: "18 min",
    reflexion:
      "¿Qué intención querés sostener estos 15 días? Escribila en una frase corta y dejala a mano.",
    reflexionVideo: "",
  },
  {
    dia: 2,
    titulo: "Empezar desde cero",
    intro:
      "Una práctica simple, pensada para quienes recién empiezan y para quienes quieren volver a empezar. No hay nada que lograr: buscá una postura cómoda, cerrá los ojos y dejá que la voz te lleve.",
    introVideo: "",
    meditacion: "Meditación guiada simple para principiantes",
    meditacionVideo: yt("UD87tGkyrs8"),
    duracion: "23 min",
    reflexion:
      "¿Cómo te sentís ahora, comparado con antes de empezar? No hace falta responder bien: alcanza con notarlo.",
    reflexionVideo: "",
  },
  {
    dia: 3,
    titulo: "Bajar las revoluciones",
    intro:
      "La mente va rápido casi todo el día; hoy la práctica es darle un respiro. Si aparecen pensamientos, no pelees con ellos: dejalos pasar como nubes. Probá hacerla a la misma hora que ayer, así el hábito se va armando.",
    introVideo: "",
    meditacion: "Meditación para calmar la mente",
    meditacionVideo: yt("JmNFyuovHcM"),
    duracion: "22 min",
    reflexion:
      "¿Qué pensamiento volvió más veces? No lo juzgues: nombrarlo ya le quita un poco de fuerza.",
    reflexionVideo: "",
  },
  {
    dia: 4,
    titulo: "Mover el cuerpo, aquietar la mente",
    intro:
      "Hoy empezamos moviendo el cuerpo para después quedarnos en silencio. Es más fácil soltar cuando el cuerpo ya se sacudió un poco la tensión del día. Hacela con ropa cómoda y algo de espacio a tu alrededor.",
    introVideo: "",
    meditacion: "Meditación del movimiento a la quietud",
    meditacionVideo: yt("DBCvWqvv5xE"),
    duracion: "25 min",
    reflexion:
      "Fijate cómo quedó el cuerpo después de moverse y quedarse quieto. ¿Dónde lo sentís más liviano?",
    reflexionVideo: "",
  },
  {
    dia: 5,
    titulo: "Soltar el esfuerzo",
    intro:
      "Gurudev dice que la meditación es el arte de no hacer nada. Hoy la invitación es esa: no intentar meditar bien, no forzar el silencio. Si te distraés, volvé con suavidad, sin retarte.",
    introVideo: "",
    meditacion: "Meditación sin esfuerzo",
    meditacionVideo: yt("-v4W5O8R050"),
    duracion: "20 min",
    reflexion:
      "¿En qué momento de hoy podrías hacer un poco menos de fuerza y dejar que las cosas fluyan?",
    reflexionVideo: "",
  },
  {
    dia: 6,
    titulo: "Bhramari: la respiración que zumba",
    intro:
      "Bhramari es una respiración en la que hacés un zumbido suave, como el de una abeja, con los oídos tapados. La vibración aquieta la mente muy rápido y viene bárbaro las noches en que cuesta dormir. Si al principio te da risa, no pasa nada: es parte.",
    introVideo: "",
    meditacion: "Meditación con la respiración de la abeja",
    meditacionVideo: yt("J1MwcuRU0r8"),
    duracion: "27 min",
    reflexion:
      "Antes de volver al celular, quedate un minuto más con la vibración que quedó. ¿Qué cambió?",
    reflexionVideo: "",
  },
  {
    dia: 7,
    titulo: "Aflojar el estrés",
    intro:
      "Llegaste a la primera semana. Hoy la práctica apunta a aflojar el estrés y la ansiedad que se acumulan en el cuerpo. Antes de empezar, fijate dónde sentís tensión (mandíbula, hombros, panza) y volvé a mirar ese lugar al terminar.",
    introVideo: "",
    meditacion: "Meditación para aliviar el estrés y la ansiedad",
    meditacionVideo: yt("nO230QHoiU8"),
    duracion: "21 min",
    reflexion:
      "Volvé a ese lugar del cuerpo donde había tensión: ¿cómo está ahora? ¿Qué te llevás de esta primera semana?",
    reflexionVideo: "",
  },
  {
    dia: 8,
    titulo: "Cuando la mente no para de hablar",
    intro:
      "Esa voz que comenta todo, planifica y repasa conversaciones: hoy le bajamos el volumen. No se trata de callarla a la fuerza, sino de dejar de seguirla. Cada vez que te das cuenta de que te fuiste, eso ya es meditar.",
    introVideo: "",
    meditacion: "Meditación para detener la charla de la mente",
    meditacionVideo: yt("QrMjjBRNo7c"),
    duracion: "24 min",
    reflexion:
      "Hoy, cada vez que te descubras en una conversación imaginaria, respirá hondo y volvé al presente. ¿Cuántas veces pasó?",
    reflexionVideo: "",
  },
  {
    dia: 9,
    titulo: "Cargar las pilas",
    intro:
      "Una meditación para renovar la energía y terminar con más ganas que las que tenías al empezar. Si podés, hacela a la mañana y fijate cómo cambia el resto de tu día.",
    introVideo: "",
    meditacion: "Meditación para la energía positiva",
    meditacionVideo: yt("VkFW5qbm3GM"),
    duracion: "21 min",
    reflexion:
      "¿Qué te da energía y qué te la saca? Anotá una cosa de cada lado.",
    reflexionVideo: "",
  },
  {
    dia: 10,
    titulo: "Mirar sin apuro",
    intro:
      "Hoy la práctica es distinta: meditamos con los ojos abiertos. Es un puente entre el silencio de la meditación y la vida cotidiana. Elegí un punto donde apoyar la mirada y dejá que se vuelva suave.",
    introVideo: "",
    meditacion: "Meditación con los ojos abiertos",
    meditacionVideo: yt("0D-V5eyai78"),
    duracion: "22 min",
    reflexion:
      "Durante el día, probá mirar algo con la misma mirada suave de hoy: una planta, el cielo, una cara conocida.",
    reflexionVideo: "",
  },
  {
    dia: 11,
    titulo: "Abrir el corazón",
    intro:
      "Gurudev te guía hacia el centro del pecho, donde vive Anahata, el chakra del corazón. La intención de hoy es suavizar algo que venías cargando: un enojo, una distancia, una exigencia con vos. Si te sale, al terminar mandale un mensaje lindo a alguien.",
    introVideo: "",
    meditacion: "Meditación Anahata: el chakra del corazón",
    meditacionVideo: yt("9eSGEq9gZkk"),
    duracion: "26 min",
    reflexion:
      "¿Qué se ablandó en vos durante la práctica? Nombralo en una palabra.",
    reflexionVideo: "",
  },
  {
    dia: 12,
    titulo: "Del ruido a la claridad",
    intro:
      "Partimos del sonido y lo dejamos apagarse hasta quedar en silencio. En ese espacio muchas veces aparece la claridad que no encontrás pensando. Si tenés una decisión dando vueltas, llevala a la práctica sin buscar respuesta y fijate qué queda después.",
    introVideo: "",
    meditacion: "Meditación para la claridad: del sonido al silencio",
    meditacionVideo: yt("03dAIpAdTA8"),
    duracion: "23 min",
    reflexion:
      "Si llevaste una decisión a la práctica, ¿qué quedó de ella después del silencio?",
    reflexionVideo: "",
  },
  {
    dia: 13,
    titulo: "La alegría como práctica",
    intro:
      "Gurudev dice que la alegría es nuestra naturaleza, no algo que haya que salir a buscar. Hoy meditamos para reconectar con eso. Al final, anotá una cosa chiquita que te haya hecho sonreír hoy.",
    introVideo: "",
    meditacion: "Meditación de la felicidad y la alegría",
    meditacionVideo: yt("kzK21NIrAdY"),
    duracion: "19 min",
    reflexion:
      "¿Dónde apareció la alegría hoy sin que la fueras a buscar?",
    reflexionVideo: "",
  },
  {
    dia: 14,
    titulo: "Más grande que el cuerpo",
    intro:
      "Una meditación para expandir la conciencia más allá del cuerpo y de los problemas de siempre. A veces lo que parece enorme se achica cuando por dentro nos hacemos más grandes. Mañana es el último día: preparate para cerrar.",
    introVideo: "",
    meditacion: "Meditación de la expansión",
    meditacionVideo: yt("G90fqasBSlE"),
    duracion: "23 min",
    reflexion:
      "¿Qué problema se ve un poco más chico ahora que antes de meditar?",
    reflexionVideo: "",
  },
  {
    dia: 15,
    titulo: "Cerrar con gratitud",
    intro:
      "Día 15: lo lograste. Cerramos el recorrido con una meditación de Gurudev sobre la gracia, esa lluvia suave que llega cuando dejamos de empujar. Tomate un momento para agradecerte el camino y celebrar a quienes practicaron a la par: la práctica sigue, a tu ritmo.",
    introVideo: "",
    meditacion: "Meditación “Lluvia de gracia”",
    meditacionVideo: yt("lYAb6LHu3tg"),
    duracion: "20 min",
    reflexion:
      "Mirá para atrás estos 15 días: ¿qué cambió en vos? Agradecete el camino, con los días que hayan sido.",
    reflexionVideo: "",
  },
];
