# PROGRESS — BROTE checkout directo

Spec: [`docs/plans/brote-checkout-directo.md`](../docs/plans/brote-checkout-directo.md)

**Todo agente spawneado lee este archivo primero.**

## Merged

| Unit | PR | Qué shippeó | Catches notables |
|---|---|---|---|
| — | — | — | — |

## En vuelo

**U1** — PR [#53](https://github.com/harisolaas/harisolaas-v2/pull/53), rama
`brote/u1-ticket-email-helper`. CI verde, review adversarial + Copilot
respondidos (2 required changes aplicadas), threads resueltos. **Esperando
"mergealo" del owner.**

**U2** — rama `brote/u2-post-payment-contact`, stackeada sobre U1.

### U2 — candidate table

| Wrong implementation | Qué assertion lo mata | Re-run vs código final |
|---|---|---|
| M1 se cae el pre-check de colisión persona/evento | ninguna — **absorbido** por el catch 23505 (rollback, `email_taken` igual). El índice es la autoridad; el pre-check es UX | ✅ comportamiento correcto |
| M2 `phone` sticky (`COALESCE`) en vez de pisar | `overwrites an existing phone rather than keeping the stored one` | ✅ muere (test agregado — los fixtures sembraban `phone: null` y no distinguían) |
| M3 `metadata =` en vez del merge `\|\|` | `moves the canonical email to the confirmed one and flags MP's` | ✅ muere |
| M4 off-by-one en el tope de reenvíos (`<=`) | `stops resending after the cap` | ✅ muere |
| M5 no reenvía cuando el mail nunca salió | `sends when the ticket exists but was never emailed` | ✅ muere |
| M6 `mpPayer` guarda el email confirmado en vez del de MP | `moves the canonical email ... and flags MP's` | ✅ muere |
| M7 lookup con el email sin normalizar | `normalizes the confirmed email before looking anyone up` | ✅ muere (test agregado) |
| M8 se cae el `FOR UPDATE` de la participación | ❌ ningún test — requiere interleaving real de dos transacciones | ⚠️ sin cobertura; cubierto parcialmente por `survives a resubmit` (la variante secuencial, que es la realista) |
| M9 el endpoint emite entrada cuando no hay webhook todavía | `parks the contact and issues NO ticket when the webhook hasn't landed` | ✅ muere |

**Hallazgo real del mutation testing (M1):** `isUniqueViolation` miraba
`err.code`, pero drizzle **no** re-lanza el error de pg — lo envuelve en un
`DrizzleQueryError` cuyo `code` propio es `undefined` y cuyo `cause` tiene el
real. El safety net entero era código muerto y una carrera perdida habría
dado 500 en vez de `email_taken`. Ahora camina la cadena de `cause` y hay un
test que **provoca una violación real** para pinchar la forma (un upgrade del
driver podría moverla otra vez).

### U1 — candidate table

| Wrong implementation | Qué assertion lo mata | Re-run vs código final |
|---|---|---|
| C1 extracción fiel: `result.data?.id` sin mirar `result.error` (el bug que tienen HOY los 3 call sites) | `throws on a non-throwing Resend API error` | ✅ muere |
| C3 `metadata: sql\`{...}\`` en vez del merge `\|\|` | `merges the flag without dropping sibling metadata keys` | ✅ muere |
| C4 el QR codifica `paymentId` en vez de `ticketId` | `encodes the gate URL for this exact ticket in the QR` | ✅ muere |
| C5 el subject pierde el número de árbol | `sends to the requested address with the QR attached inline` | ✅ muere |
| C6 error de Resend logueado en vez de lanzado | `throws on a non-throwing Resend API error` | ✅ muere |
| C8 respuesta ambigua `{data:null,error:null}` → devuelve éxito y el caller estampa `emailSent` | `throws on an ambiguous {data:null,error:null} response` | ✅ muere (agregado tras el review) |
| C2a **null implementation**: helper exportado pero los call sites conservan su copia inline | ❌ ningún test — probe: `grep -rn "buildTicketEmailHtml\|qrDataUrlToBuffer" src/app/api/brote/` → **NONE** | ✅ refutado |
| C2b **sink drop**: el call site llama al helper pero omite `markBroteTicketEmailSent` → el webhook reenvía la entrada en cada notificación de MP | ❌ ningún test — probe: `grep -rn "sendBroteTicketEmail(\|markBroteTicketEmailSent(" src/app/api/brote/` → 3 pares (webhook 400/407, admin 267/274, admin 611/618) | ✅ refutado |
| C7 **ordering**: el caller marca `emailSent` antes de esperar el envío | ❌ ningún test — mitigado por diseño (el helper no escribe el flag) + review | ⚠️ sin cobertura automática |

### U3 — candidate table (corregida tras el review)

| Wrong implementation | Qué lo mata | Re-run |
|---|---|---|
| N1 el CTA sigue navegando a la página borrada | ❌ **ningún test ni el build.** `window.location.href = "/es/brote/checkout"` es un string; Next no valida hrefs, así que el build queda verde y el CTA 404ea en runtime. Killer real = grep BC2 + smoke manual | ⚠️ **sin cobertura** |
| N2 queda un link interno a `/brote/checkout` | BC2: `grep -rn "brote/checkout" src scripts` | ✅ encontró 2 reales |
| N3 `resolveBuyerInfo` explota sin `readStashByEmail` | `skips the email stash entirely when no reader is supplied` | ✅ muere (contra el código previo: TypeError) |
| N4 el guard de `type` rechaza pagos legítimos | ❌ ningún test — no hay tests de webhook en el repo. Verificado por lectura en toda la historia de git: **toda** preferencia BROTE estampa `type:"ticket"` (`634b2db`, `771a17b`, `87adfe5`, HEAD), unarbol y cima también, y `gift-ticket` no crea preferencia | ⚠️ sin cobertura automática |
| N5 el dict queda desparejo entre es/en | `tsc` sobre `Dictionary` — **no** `dictionaries.test.ts`, que solo camina `mentoria` y `now` | ✅ |
| N6 el error del CTA se renderiza al lado del botón en vez de abajo | ❌ ningún test — no hay infra de tests de componente (`environment: "node"`, sin RTL/jsdom). Lo encontró el review leyendo el contenedor flex | ⚠️ sin cobertura |

**El camino que este PR cambia — el click del CTA en un sitio que está
vendiendo — no tiene cobertura automática de ningún tipo.** Agregar infra de
tests de componente es alcance nuevo y queda cortado; la mitigación es el
grep BC2 más el smoke test del owner en el preview.

## Queue

1. ~~**U1**~~ — en vuelo.
2. **U2** — confirmación de contacto post-pago (aditivo: `external_reference`, webhook, `/api/brote/confirm-contact`, `/success`, copy).
3. **U3** — sacar la fricción pre-pago (landing directo a MP, borrado del stack de verificación, `mp-buyer-info`, seeder).

Orden fijo: U2 **antes** de U3 para que nunca exista una ventana en la que el
sitio no captura identidad de ninguna forma.

## Blocked

_(vacío)_

## Hard-won constraints

- **El worktree no tiene `.env.local`.** Sin él, 9 de 16 archivos de test fallan
  en el import de `src/db/index.ts`. Resuelto con
  `ln -s /Users/haraldsolaas/code/harisolaas-v2/.env.local .env.local`
  (gitignored por `.env*.local`). Verificar que existe antes de correr tests.
- **La suite tarda ~140s** (tests contra la branch Neon dev, `maxWorkers: 1`
  para evitar races). No correrla con timeout por defecto de 120s — usar
  background o timeout ≥ 240s.
- **Baseline verde:** 16 archivos / 189 tests (commit `ae7556d`).
- **Las entradas NO viven en Redis.** Viven en `people` + `participations`.
  CLAUDE.md está desactualizado en esto; `BroteTicket` es solo la forma que
  consume el template del mail.
- **`people.email` es UNIQUE (citext).** Cualquier cambio de email tiene que
  contemplar colisión con una person existente.
- **`participations` tiene unique `(person_id, event_id)`.** Re-apuntar
  `personId` puede violarlo.
- **CI corre `npm run build`** (type-check de rutas Next) además de lint y test.
  Un `tsc --noEmit` local no es equivalente.
- **Copilot se pide por REST con el sufijo `[bot]`**, no por GraphQL ni por
  `gh pr edit --add-reviewer` (ver `docs/ops/pr-review.md`).
- **Sitio LIVE:** no se mergea sin "mergealo" explícito del owner.
- **CI NO corre en PRs stackeados.** `.github/workflows/ci.yml` dispara con
  `pull_request: branches: [main]`. Un PR que apunta a otra rama solo recibe
  los checks de Vercel. Al mergear el padre, GitHub re-apunta la base a `main`
  y ahí sí corre. Merge order: #53 → (CI de #55) → #55 → (CI de U3) → U3.
- **La suite puede flakear.** Una corrida dio 14 fallos en 5 archivos y las
  dos siguientes, sobre el mismo código sin tocar nada, dieron 217/217. La DB
  quedó limpia (verificado: sin eventos `test-*`, sin people huérfanas). La
  causa más probable es el cold start / suspend de la branch Neon dev. Ante
  un rojo, re-correr antes de concluir que es real — y **no** pipear la
  corrida por `tail` cuando va en background, porque se pierde el detalle del
  fallo (eso pasó acá y por eso no hay diagnóstico exacto).
- **No verificar el estado de la DB dev con SQL suelto desde bash** — usar un
  test temporal `src/lib/zz-*.test.ts` y borrarlo, que es la única vía con el
  driver y las env vars ya cargadas.

## Auditoría zero-context (midpoint)

Agente sin contexto del programa, con una sola frase de encargo: *"auditá el
flujo de compra y entrega de entradas de BROTE"*. Encontró 9 hallazgos.
Triage según la regla **"arreglamos lo que rompimos, documentamos lo que
encontramos"**:

### Arreglado en U2 (lo introdujo este programa)

| Hallazgo | Qué era | Fix |
|---|---|---|
| **#3a** token `ct` exportado a PostHog | U2 puso el token en `external_reference` y `/success` lo leía del query string. `capture_pageview` manda `$current_url` entero a PostHog Cloud → un token de capacidad viajando a un tercero, 7 días de TTL, sin invalidar tras uso | Se elimina la lectura del query param (localStorage era el primario igual) **y** se agrega `sanitize_properties` en `analytics.ts`. El sanitizer también tapa la fuga preexistente del `verifCode` del magic link |
| **#3b** PII del comprador anterior en navegador compartido | El token quedaba en localStorage para siempre; `/brote/success` es URL pública, así que el siguiente en un navegador compartido veía nombre/email/teléfono en el prefill y podía reescribir la dirección de entrega | Se borra el token tras usarlo y al detectar `confirmed: true` |

### Backlog — preexistente, NO lo introdujo este programa

Nada de esto entra a la cola: no está en la misma revert boundary y no
re-rompe ningún fix. Va abajo con severidad y trigger. **Los dos HIGH
necesitan decisión del owner y están en el handback.**

## Carry-forward / backlog

| Item | Severidad | Tamaño | Trigger |
|---|---|---|---|
| **La puerta no tiene auth.** `/api/brote/validate` no tiene bearer, sesión ni rate limit, y `/es/brote/gate` es un client component público. El QR de cada entrada linkea justo ahí, así que quien vea una foto de un QR (cola de entrada, mail reenviado, story de Instagram) abre la URL y tiene un botón "marcar como usada". El `use` es permanente y no hay des-usar. Los IDs NO son enumerables (~41,5 bits), así que es ataque con ID visto, no fuerza bruta | **HIGH** | M | **Antes del 20/8** — es el día del evento |
| **El webhook de BROTE falla abierto sin `MP_WEBHOOK_SECRET`** (`if (!secret) return true`, sin chequeo de `NODE_ENV`). Los dos webhooks hermanos de Sinergia ya fueron endurecidos contra exactamente esto, con comentario explícito; el de BROTE — el único que emite una entrada paga — quedó afuera. **Agravante:** no valida `payment.metadata.type === "ticket"`, y los tres flujos comparten `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET`. Si hay webhooks a nivel cuenta en el dashboard de MP, un aporte de Sinergia de $5.000 entregado a `/api/brote/webhook` emite una entrada gratis de $24.750 | **HIGH** | S | **Antes del 20/8**; el guard de `metadata.type` son 3 líneas |
| Emails con HTML sin escapar desde `brote@harisolaas.com`: `/api/brote/register` acepta `name` anónimo sin verificar ni acotar y lo interpola crudo en `plant-email.ts:204`. Permite mandar mail firmado con DKIM desde el dominio propio, con cuerpo HTML elegido por quien ataca. `escapeHtml` ya existe en `brote-verification-email.ts`, solo no se aplicó | MEDIUM-HIGH | S | Antes de la próxima campaña |
| Plata cobrada sin entrada: el pre-check de duplicado solo bloquea `confirmed`/`used`, así que una participación `cancelled` pasa, se cobra, y el webhook la trata como pago duplicado — alerta al admin y **no manda entrada**. Además la idempotencia del webhook es `get` + `set` no atómico (los hermanos ya usan `SET NX`) y `brote:payment:*` se escribe sin TTL | MEDIUM | M | Si aparece un caso, o al próximo evento |
| La confirmación de contacto reescribe la identidad global (`people` es la tabla cross-event). Es lo que el owner pidió explícitamente ("el mail de /success es el bueno"), pero el efecto se extiende a Sinergia, plantaciones y toda audiencia de bulk email | MEDIUM | M | Decisión del owner — ver handback |
| `Bearer ${undefined}` autentica si la env var no está seteada (`brote/admin`, `attendees`, `sinergia/admin`, `cron/plant-reminder`, `sinergia/send-reminders`). `CRON_SECRET` no está ni en `.env.local` ni en el example | MEDIUM | XS | Verificar en Vercel |
| Rate limits en memoria son decorativos en serverless (cada lambda tiene su `Map`) | LOW | M | Si hay abuso |
| El `ts` del manifest HMAC no se chequea por frescura; comparación con `!==` en vez de `timingSafeEqual`. Aplica a los tres webhooks | LOW | S | Endurecimiento general |
| `/es/brote/gate` no está en `robots.ts` ni tiene `noindex` | LOW | XS | Junto con el fix de auth de la puerta |
| Límite de intentos del código de verificación no aplica una vez que la fila está `verified` (el UPDATE atómico está scopeado a `pending`) | LOW | S | Si se reactiva el checkout verificado |
| Atribución UTM de BROTE muerta — el webhook lee `checkoutMeta.source/medium/campaign/linkSlug` pero ni la landing ni `/api/brote/checkout` los escriben nunca (verificado en `git log`: nunca existió). Las entradas se registran sin atribución. | Media | S | Antes de la próxima campaña paga |
| Recuperación de pagos sin email de MP vía `brote:orphan-payment:{ct}` (hoy: alerta al admin y no se emite entrada) | Baja | M | Si aparece un caso real |
| `/brote-unarbol` y `/brote-cima` siguen en 410 con precios `STALE` de la ed. 1 | Baja | S | Al reactivar descuentos |
| `src/lib/admin-auth.ts:133` llama `redis.expire(...)`, que el mock de `src/lib/redis.ts` **no implementa**. Con `MOCK_REDIS=1` (ahora el default de la suite) cualquier test que toque ese camino explota. Ningún test lo toca hoy. | Baja | XS | Al testear admin-auth, o agregar `expire` al mock |
| Los 3 call sites del mail de entrada trataban un error de API de Resend (no-throw) como envío exitoso, marcando `emailSent: true` sobre una entrada no entregada — y en el webhook eso suprime el reintento de MP. **Arreglado en U1** (misma revert boundary: U2 construye el reenvío sobre ese flag). | — | — | Done en U1 |

## Dispositions

_(se completa en Landing)_
