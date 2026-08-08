# Lessons — hechos del codebase que cuestan un ciclo aprender

Codebase-wide, no específicos de un programa. Agregá acá lo que te haría
perder un PR entero si no lo supieras de antemano.

## Entorno

- **`.env.local` apunta a PRODUCCIÓN.** Trae el `REDIS_URL` de prod (con las
  claves `brote:payment:*` vivas y `brote:counter`), un `MP_ACCESS_TOKEN`
  `APP_USR-`, el `RESEND_API_KEY` real con `RESEND_FROM_EMAIL=brote@harisolaas.com`
  y `NEXT_PUBLIC_BASE_URL=https://www.harisolaas.com`. Solo `DATABASE_URL`
  apunta a algo seguro (una branch Neon dev). `vitest.config.ts` lo carga vía
  dotenv, así que **cualquier test que llame a `getRedis()`, Resend o MP sin
  mock toca producción**. El guard de Redis ya es estructural
  (`test.env: { MOCK_REDIS: "1" }`); email y MP no tienen equivalente —
  mockealos explícitamente.
- **Los worktrees no tienen `.env.local` propio.** Sin él fallan 9 archivos de
  test en el import de `src/db/index.ts`. Symlinkeá el del checkout principal
  — y heredá el riesgo de arriba con él.
- **La suite tarda ~170s** (Neon dev, `maxWorkers: 1` para serializar). No la
  corras con el timeout por defecto de 120s. Y **no la pipees por `tail`
  cuando va en background**: se pierde el detalle del fallo y quedás sin
  diagnóstico.
- **La suite puede flakear.** Una corrida dio 14 fallos en 5 archivos y las
  dos siguientes, sobre el mismo código, dieron verde con la DB limpia.
  Probable cold start de Neon. Ante un rojo, re-corré antes de concluir.
- **Para inspeccionar la DB dev, escribí un test temporal** `src/lib/zz-*.test.ts`
  y borralo. Es la única vía con el driver y las env vars ya cargadas.

## CI y PRs

- **CI no corre en PRs stackeados.** `.github/workflows/ci.yml` dispara con
  `pull_request: branches: [main]`; un PR que apunta a otra rama solo recibe
  checks de Vercel. Al mergear el padre, GitHub re-apunta la base y ahí sí
  corre. Si vas a stackear, planificá el merge order y decilo en el PR.
- **CI corre `npm run build`**, que es el type-check de las rutas de Next.
  `tsc --noEmit` local **no** es equivalente: no ve `.next/types/validator.ts`,
  que referencia cada ruta. Después de borrar una ruta, `rm -rf .next` antes
  de creerle al typecheck.
- **Copilot puede no engancharse.** El POST REST con sufijo `[bot]` a veces
  devuelve 200 con `requested_reviewers` vacío. Igual suele comentar solo unos
  minutos después — chequeá `/pulls/{n}/comments` antes de darlo por perdido.

## Datos

- **Las entradas de BROTE NO viven en Redis**, viven en `people` +
  `participations`. CLAUDE.md está desactualizado. `BroteTicket` es solo la
  forma que consume el template del mail.
- **`people` es la tabla de identidad cross-event.** La misma fila respalda
  RSVPs de Sinergia, plantaciones y toda audiencia de bulk email. Tocar
  `people.email` o `people.phone` desde un flujo de un evento tiene efectos
  en todos los demás.
- **`people.email` es `citext` con unique**, así que la unicidad ya es
  case-insensitive — no hace falta lowercasear para comparar. Sí conviene
  normalizar lo que se **guarda**, para que la forma almacenada no dependa de
  qué camino llegó primero.
- **`participations` tiene unique `(person_id, event_id)`.** Re-apuntar
  `personId` puede violarlo.
- **`BROTE_EVENT_ID` no existe en la branch Neon dev.** Un helper que cierre
  sobre él es intesteable; pasá `eventId` como parámetro. Los tests DB-backed
  crean su propio evento sintético y limpian por prefijo de email.

## Drizzle / Postgres

- **Drizzle NO re-lanza el error de pg: lo envuelve.** El `DrizzleQueryError`
  tiene `code: undefined` y el código real vive en `cause`. Un
  `if (err.code === "23505")` nunca matchea y todo el manejo de carreras
  queda como código muerto en silencio. Caminá la cadena de `cause`, y
  pinchalo con un test que provoque una violación real — un upgrade del
  driver puede moverlo otra vez.
- **El merge jsonb `||` es shallow**: reemplaza la clave de primer nivel
  entera, no hace deep merge. Si escribís `{a: {x: 1}}` sobre `{a: {y: 2}}`,
  `y` desaparece.

## Email

- **El SDK de Resend no tira excepción ante errores de API** — devuelve
  `{data, error}`. Éxito significa **las dos cosas**: sin `error` y con un id
  en `data`. Tratarlo mal ya costó 19 mails sin entregar el 2026-04-19
  (documentado en `bulk-email.ts`) y volvió por otra puerta en el mail de
  entradas de BROTE. Cualquier flag de idempotencia que se estampe después de
  "enviar" hereda el bug.
- **Los builders de email interpolan sin escapar.** `plant-email.ts`,
  `brote-email.ts`, `bulk-email.ts` y `sinergia-email.ts` no tienen
  `escapeHtml`; `brote-verification-email.ts` sí. Si un dato viene de un
  usuario, escapalo antes de meterlo en el HTML.

## MercadoPago

- **Los tres flujos comparten `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET`.** Cada
  uno estampa su propio `metadata.type`; el webhook **tiene que** verificarlo,
  o un pago de otro flujo entregado a la URL equivocada emite lo que no
  corresponde.
- **Lo que MP devuelve en el back_url no está verificado en este repo.**
  Sinergia solo prueba que `external_reference` llega al objeto `Payment`
  (server-side). No cuelgues nada del query string de vuelta sin verificarlo
  con un pago real — y si igual va algo sensible ahí, acordate de que
  `capture_pageview` manda `$current_url` entero a PostHog.
- **`auto_return: "approved"` solo auto-redirige pagos aprobados.** Un pago en
  efectivo queda pendiente días y la persona tiene que tocar "volver al
  sitio"; muchos no lo hacen.

## Analytics

- **PostHog captura `$current_url` con query string.** Cualquier credencial en
  una URL (códigos de verificación, tokens de capacidad) se exporta a un
  tercero. `analytics.ts` tiene un `sanitize_properties` con una lista de
  params a redactar — **agregá ahí** cualquier param sensible nuevo. Ojo: un
  strip de params hecho en un `useEffect` de un componente hijo corre
  **después** del efecto de PostHog en el layout, así que no alcanza.
