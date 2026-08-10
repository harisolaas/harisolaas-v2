# PROGRESS — BROTE invitaciones de colaboradores

Spec: [`tasks/brote-invitaciones-colaboradores.md`](./brote-invitaciones-colaboradores.md)
**Todo agente que se spawnee en este programa lee este archivo primero.**

Worktree: `/Users/haraldsolaas/code/harisolaas-v2/.claude/worktrees/structured-conjuring-micali`
Rama base: `main`. **El sitio está VIVO — no se pushea a main sin aprobación explícita del owner.**

---

## Merged

| Unidad | PR | Qué shippeó | Catches notables |
|---|---|---|---|
| **U1** | [#57](https://github.com/harisolaas/harisolaas-v2/pull/57) → `3815043` | Atribución en el camino de pago: `readBrowserAttribution` (puro), la landing manda `utm`+`linkSlug`, el checkout escribe los 4 campos planos en el stash bajo **dos** anclajes (`preferenceId` y `confirmToken`), el webhook pasa `bypassLinkSlug`. Sin schema. | **Revisor adversarial:** dos mutaciones pasaban 6/6 porque nada miraba el stash by-email ni un payment sin `preference_id`; y borrar el hunk entero del cliente dejaba la suite verde → se extrajo el helper puro. **Copilot:** `?utm_content=` vacío le ganaba a la cookie y devolvía un slug vacío (bug real). **Causa raíz de CI roto para todo el repo:** `resetTestData` no barría `links`, así que una fila `test-bypass-link-*` de una corrida abortada rompía todas las siguientes. |

## Queue

| # | Unidad | Estado |
|---|---|---|
| ~~U1~~ | ~~Capturar atribución en el camino de pago de BROTE~~ | ✅ **merged** (`3815043`) |
| U2 | Registro de invitaciones + precio autoritativo del servidor | **PR [#60](https://github.com/harisolaas/harisolaas-v2/pull/60)** — revisión adversarial + Copilot respondidos, threads resueltos. Esperando CI verde y "mergealo". |
| U3 | Filas de links rastreados + seeder de preview | pendiente |
| U4 | Las cinco páginas de invitación | pendiente |
| U5 | Retirar `/brote-unarbol` y `/brote-cima` | pendiente |

Auditoría zero-context de midpoint: después de U3.

## Blocked

| Ítem | Espera | Pedido a / cuándo |
|---|---|---|
| Check punta-a-punta de U3 (`--execute` contra preview) | `vercel env pull .env.local --environment=preview` en **este worktree** | owner, aún no pedido — se pide al llegar a U3 |
| Punto 3 del downgrade de U1 (MP propaga metadata de Preference→Payment) | primera compra real en prod | owner, va a la checklist final |

---

## 🔴 Colisión con el programa `checkout-directo` (2026-08-08)

Mientras U1 estaba en review, **otro programa mergeó 3 PRs a main** (#53, #58, #56) y rehízo el camino de compra. Ver `tasks/PROGRESS-checkout-directo.md` y `tasks/HANDBACK.md`.

Lo que se llevó puesto y **ya no existe**: `BroteCheckoutForm.tsx`, `/[locale]/brote/checkout`, `/api/brote/verify-email`, la clave `brote:checkout-by-email:*`, el guard `stashHolder.source !== "preference"` y `metadata.buyer_*`.

Consecuencias aplicadas a este programa:

- **U1 se reescribió sobre el main nuevo.** La rama se reseteó (ref de respaldo: tag `u1-preU3-backup`). Los tests T1.5 y T1.7 de la primera versión se **borraron**: fijaban el stash by-email y el guard, que dejaron de existir. Reescribirlos hubiera sido fijar fantasmas.
- **El enganche del cliente se movió** de `BroteCheckoutForm` a `BroteLanding.handleCheckout`. Ahora es **un** call site en vez de dos, y se lee al momento del click (la landing nunca reescribe su propia URL, así que no hace falta effect ni ref).
- **[R1] del spec queda obsoleta.** No hay más round-trip de verificación por email, así que no hay nada que threadear. U2 se simplifica: la invitación puede ir derecho a MercadoPago.
- **U2 tiene que replanificarse** contra la forma nueva antes de escribir una línea: `/api/brote/checkout` ya no recibe identidad, usa `currentTicketPrice()` de `src/data/brote.ts`, y setea `external_reference: confirmToken`.

## Hard-won constraints

Una línea cada uno. Violarlos cuesta un ciclo de PR completo.

- **`REDIS_URL` en `.env.local` apunta a PRODUCCIÓN** — tenía 105 claves `brote:payment:*` vivas y `brote:counter=95` con el evento vendiendo. `vitest.config.ts` ahora fuerza `MOCK_REDIS: "1"` para toda la suite, así que es estructuralmente imposible escribir ahí desde un test. **Email (Resend) y MercadoPago NO tienen guard equivalente** — mockealos explícitamente en cada test.
- `DATABASE_URL` en ese mismo archivo apunta a la branch **dev** de Neon (verificado por el otro programa: sólo eventos `preview-*` y `test-*`).
- El precio sale de `currentTicketPrice()` en `src/data/brote.ts`, un solo helper que comparten la landing y la ruta de checkout. **No recalcular el early bird a mano** — es justo la deriva que ese helper existe para evitar.
- `resolveBuyerInfo` **conserva** `readStashByEmail`, pero ahora es opcional y el webhook de BROTE ya no lo pasa. Lo usa `scripts/backfill-asistente-names.ts` contra otra clave.
- **CI flakea cuando dos corridas se pisan sobre la branch dev de Neon.** `maxWorkers: 1` serializa *dentro* de una corrida, no entre dos. Síntoma: fallas en `community.test.ts` con `CapacityReachedError` en `test-evt-capped` y `23503 ... is still referenced from table "participations"` — filas sobrantes de otra corrida, no un bug del diff. **Ante un rojo en tests con DB, re-correr antes de concluir que es real** (visto en la corrida `31281181116`, con el mismo código que había pasado verde minutos antes en `31281076120`).

- **Este worktree no tiene `.env.local`.** `npm test` da 9 archivos fallando con `DATABASE_URL is required` y 7 pasando (83 tests verdes). **Ese es el baseline esperado, no una regresión.** CI sí inyecta `DATABASE_URL_DEV`.
- **Nunca copiar el `.env.local` del checkout padre**: apunta a producción (Redis, token de MP y sender de Resend productivos). `vitest.config.ts` lo carga relativo al cwd, así que no se filtra solo — pero copiarlo rompería esa protección.
- Las dependencias se resuelven desde el checkout padre (`node_modules` del padre) porque este worktree vive adentro. No correr `npm install` acá.
- **No tocar `.next` mientras el dev server del owner corre** en el puerto 3000 — chequear `lsof` antes de cualquier `rm -rf .next` o `next build`.
- El webhook de BROTE lee `source`/`medium`/`campaign`/`linkSlug` **planos** en el stash de Redis; `sinergia-parrafo/checkout` los anida bajo `attribution:`. **No copiar el patrón de sinergia-parrafo.**
- `participations.referred_by_person_id` se escribe **sólo** desde `recordParticipation({ bypassLinkSlug })`, nunca desde `attribution.linkSlug`.
- `src/proxy.ts` **es** el middleware de Next 16 (`PROXY_FILENAME = 'proxy'`). Los `redirects()` de `next.config.ts` corren **antes** que él.
- `permanent: true` en un redirect de Next emite **308**, no 301.
- No hay `@testing-library/*` y `vitest.config.ts` sólo incluye `src/**/*.test.ts`. **Ningún componente se puede testear con render.**
- `new MercadoPagoConfig({accessToken: undefined})` no tira, y `Resend` es lazy — por eso las rutas se pueden importar bajo mocks sin env.
- `src/dictionaries/dictionaries.test.ts` **no** cubre paridad es/en genérica: hardcodea `mentoria` y `now`.

## Auditoría zero-context (midpoint, tras U3)

Agente sin contexto del programa, encargo de una sola frase: *"auditá cómo se atribuyen las ventas de entradas de BROTE a quien las refirió"*. Nueve hallazgos. Triage según **"arreglamos lo que rompimos, documentamos lo que encontramos"**:

### 🔴 Rompe el objetivo del programa — necesita decisión del owner

**El número con el que se liquida el fee es falsificable y, en el caso común, invisible.** Son dos hallazgos que se combinan:

1. `link_slug` sale de `body.linkSlug` **sin validar** (`src/lib/attribution.ts:46`), y la query de signups del admin (`api/admin/links/[slug]/route.ts:104-116`) **no filtra por evento ni por pago**. O sea que un POST a `/api/brote/register` —el formulario **gratis** de plantación— con `linkSlug: "inv-jose"` suma +1 al contador de Jose por cada email distinto. Techo: la capacidad del evento plant (40).
2. Un `haris_link` de hasta 30 días **le gana** a la invitación (es la precedencia que fijé a propósito en T2.11), así que quien clickeó cualquier link de `/go/` en el último mes y compra desde la página de Jose queda atribuido al link viejo. El cinturón que declaré en el PR de U2 —`metadata.invite`— **no está abrochado: nada lo lee.** Ni `admin/tickets`, ni `links/[slug]`, ni `attendees`.

Neto: el conteo se puede inflar gratis y, en el caso más frecuente, ni siquiera registra al colaborador donde alguien lo vea. **Propuesta al owner: un U6 chico** — un script de lectura que cuente entradas **pagas** del evento BROTE agrupadas por `metadata.invite`. Inmune a las dos cosas: los endpoints gratuitos no escriben `metadata.invite` (sólo lo hace el webhook desde la metadata del pago), y no depende de `link_slug`.

### 🟡 Preexistente, no lo introdujo este programa — backlog

- **`bypassLinkSlug` es capacidad concedida por input del cliente.** `/api/sinergia/rsvp` acepta `linkSlug` del body y con eso entra a una cena llena de 15. `/api/sinergia/next-session?link=` es un oráculo sin auth que dice si un slug es de bypass, y los slugs son `{prefijo}-{fecha}-{nano3}` sobre 32 chars → 32.768 candidatos por prefijo/día. **Para BROTE es inerte** (capacity NULL, verificado), pero U1 sumó el mismo patrón al webhook: si BROTE alguna vez tiene cupo, se activa. Severidad alta para Sinergia, latente para BROTE.
- `scripts/backfill-link-attribution.ts` agrupa por `(source, medium, campaign)` y los cinco colaboradores comparten `partner/referral/brote-invitacion`, así que correrlo colapsaría a los cinco en un slug sintético. Sólo afecta participaciones que ya perdieron su `link_slug`.
- `trimOrUndefined` no trunca: un `linkSlug` de 300 chars entra entero al jsonb. `/go/[slug]` inserta un click por request sin rate limit.
- Un `linkSlug` no-string tira 500 en vez de 400 (`v.trim is not a function`).
- El docstring de `sanitizeAttribution` promete limpiar `content` y sólo limpia `linkSlug`.

## Carry-forward / backlog

Crece durante la ejecución por diseño.

| Ítem | Severidad | Tamaño | Trigger que lo revive |
|---|---|---|---|
| Los diccionarios `broteUnArbol`/`broteCima` citan precios de la edición 1 ($18.650 / $23.303) que ya no coinciden con `broteConfig` | baja | — | se resuelve solo en U5 (se borran) |
| `/api/brote/qr-checkout` redirige con `?src=qr` y nadie lee ese param | baja | XS | si se quiere atribuir el tráfico de los flyers impresos |
| `gift-ticket` en `/api/brote/admin` no pasa `priceCents`/`currency` → las entradas regaladas son invisibles para reporting de ingresos | media | S | cuando el reporting de ingresos importe |
| No hay rollup por referrer (la query "top referrers" de `docs/specs/01-data-model.md:602-616` nunca se implementó) | media | M | si liquidar fees a mano se vuelve tedioso |
| La expresión de early bird estaba duplicada en 3 archivos | baja | XS | resuelto por `currentTicketPrice()` en main; U2 sólo lo consume |
| **Anclar el stash del checkout por `confirmToken` (`external_reference`) en vez de por `preferenceId`.** Un Payment sin `preference_id` hoy pierde la atribución entera; el by-email que lo cubría desapareció con checkout-directo. El webhook ya lee `payment.external_reference` en `:243`, incondicionalmente y **antes** del lookup del stash, así que el fallback son ~6 líneas. Verificado por la sesión de checkout-directo. **No degrada la emisión de la entrada ni el flujo de contacto** — sólo se pierde atribución y los campos de Meta CAPI. | Media | XS | Decisión del owner, planteada junto al merge de U1 |
| **CI compartiendo una sola branch dev de Neon sin aislamiento por corrida.** Dos corridas concurrentes se pisan, una aborta, su cleanup falla con FK violation y las filas de fixture sobreviven rompiendo todas las corridas siguientes. Pasó el 8/8 y dejó CI rojo para los 5 PRs abiertos. | Media | M | Cuando vuelva a pasar, o antes del próximo programa multi-PR |

## Dispositions

*(se completa en la fase de Landing)*
