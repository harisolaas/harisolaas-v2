# Programme — BROTE: páginas de invitación de colaboradores

> Revisado por `programme-plan-reviewer` con sondas ejecutadas. Siete enmiendas vinculantes aplicadas; están marcadas **[R#]** en el punto donde cambian el plan.

## Definition of Done

El programa termina cuando:

1. Las cinco unidades U1–U5 están **merged o cortadas** (ninguna a medio aplicar).
2. Las cinco URLs `/{locale}/brote/invitacion/{pulso,matelab,unarbol,jose,gian}` sirven en prod, con el precio correcto, y el precio que cobra MercadoPago lo decide el servidor.
3. Una compra hecha desde una invitación queda con `participations.link_slug` y `metadata.invite` poblados **en el camino feliz** (con stash presente), verificable desde `/admin/links`.
4. `main` verde en todos los checks requeridos; suite y typecheck pasan en CI.
5. Todo loop abierto tiene disposición terminal (Done / Backlog con trigger / checklist del owner).

**Fuera de alcance, explícitamente** — si aparece, va al backlog, no a la cola:
- Reporting nuevo de fees o comisiones. `links` no tiene columna de fee y no se la agrega; el conteo para liquidar sale de los signups por link que `/admin/links/{slug}` ya muestra.
- Actualizar el lineup de la landing principal (Gian figura como "A anunciar") — el owner lo hace en otro PR.
- Unificar las paletas coexistentes (`@theme` de la edición 1 vs. las consts del landing actual).
- Deduplicar la expresión de early bird más allá de los call-sites que U2 ya toca.
- Cualquier migración de schema. Si alguna unidad parece necesitar una, se corta y se escala al owner.

---

## Contexto

BROTE 2 es el **jueves 20 de agosto de 2026**; la preventa ($24.750) cierra el **13 de agosto** y el regular es $33.000. Hoy es 8 de agosto: quedan 12 días de evento y 5 de preventa.

Cinco colaboradores comparten el evento desde Instagram y necesitan página propia:

| slug | nombre | handle | tipo | precio |
|---|---|---|---|---|
| `pulso` | Pulso | @pulsoclub.ba | marca | $21.450 (–35% sobre $33.000) |
| `matelab` | MateLab | @matelab.co | marca | $21.450 |
| `unarbol` | Un Árbol | @unarbol_ong | marca (partner) | $21.450 |
| `jose` | Jose Dezanzo | @josedezanzo | artista | preventa $24.750 → regular $33.000 |
| `gian` | Gian Bejarano | @_gianbejarano | artista | preventa $24.750 → regular $33.000 |

Las marcas dan descuento; los artistas mantienen precio público pero cada venta que traen debe quedar **atribuida** para liquidarles un fee por entrada.

El hallazgo que reordena el trabajo: **hoy ninguna entrada de BROTE guarda atribución.** `/api/brote/checkout` nunca llama a `buildAttribution()` ni escribe `source`/`medium`/`campaign`/`linkSlug` en el stash de Redis, así que la rama de atribución del webhook —que ya existe y ya sabe leer esos campos— es código muerto: toda participación de BROTE 2 tiene `attribution = NULL`, `link_slug = NULL`, `referred_by_person_id = NULL`. Sin cerrar eso, el fee no es liquidable. Por eso es U1 y va sola.

### Decisiones ya tomadas por el owner

- Link abierto por colaborador, sin código. Noindex, fuera del sitemap y del nav.
- 35% sobre el **regular** → $21.450 fijo, `$33.000` tachado, badge `-35%`. No cambia al terminar la preventa.
- Artistas: precio público vigente; badge `Preventa` + `$33.000` tachado hasta el 13/8; después, precio solo.
- "Tu entrada incluye": las 4 filas del handoff (árbol a tu nombre · bebida MateLab · el show · un brote para llevarte).
- `/brote-unarbol` → redirect permanente a la invitación de Un Árbol. `/brote-cima` se elimina.

---

## Prerequisitos — verificados con sondas

| # | Hecho verificado | Consecuencia |
|---|---|---|
| P1 | Este worktree no tiene `.env.local` (sólo `.env.local.example`); `DATABASE_URL`/`MP_ACCESS_TOKEN`/`REDIS_URL` tampoco están en el shell. `npm test` hoy: **9 archivos fallan, 7 pasan, 83 tests verdes**; las 9 fallas son todas `DATABASE_URL is required` en `src/db/index.ts:12`. | **[R7]** No bloquea U1 ni U2. `.github/workflows/ci.yml` inyecta `DATABASE_URL: ${{ secrets.DATABASE_URL_DEV }}` para build y test, así que DoD #4 se satisface sin acción del owner. Con el corte [R6], los tests propios de U1 y U2 corren localmente igual (mockean `@/db` y `@/lib/community`). `vercel env pull .env.local --environment=preview` queda requerido **sólo** para el `--execute` de U3 y el paso 4 de verificación. |
| P2 | El único `.env.local` del sistema está en el checkout principal y apunta a **producción**. Verificado además que `vitest.config.ts` carga `.env.local` relativo al cwd, así que el del padre **no** se filtra a este worktree pese a que las dependencias sí se resuelven desde ahí. | No copiarlo nunca. El aislamiento es real. |
| P3 | No hay credenciales de sandbox de MercadoPago (`docs/specs/NEXT.md:163`). | El check punta-a-punta con pago real no es ejecutable. Downgrade numerado en U1. |
| P4 | No hay `@testing-library/*` en `package.json` ni en `package-lock.json`; `vitest.config.ts` incluye sólo `src/**/*.test.ts`; cero archivos `.test.tsx`. | Ninguna unidad puede pincharse con render test. U4 se apoya en helpers puros + revisión + verificación visual. Se declara, no se disimula. |
| P5 | Los route tests existentes usan `vi.mock` y pegan contra la DB real. Sondeado además: el `new MercadoPagoConfig` de nivel de módulo del webhook **no** requiere `MP_ACCESS_TOKEN` (no tira), y `Resend` ya es lazy. | U1/U2 pueden testearse a nivel ruta importando las rutas bajo mocks, sin DB. |
| P6 | Ninguna unidad toca `src/db/schema.ts`: `attribution`, `linkSlug`, `referredByPersonId` y `metadata` existen en `schema.ts:275-294`. | **Sin migración.** Si alguna unidad termina necesitando una, se corta y se escala. |
| P7 | El matcher de `src/proxy.ts` matchea `/brote/invitacion/pulso`; `src/app/sitemap.ts` tiene exactamente dos entradas. Confirmado que `PROXY_FILENAME = 'proxy'` — `src/proxy.ts` **es** el middleware de Next 16. | Ni proxy ni sitemap se tocan. Noindex por página vía `generateMetadata`. |
| P8 | **[R4]** `next.config.ts` `redirects()` se evalúa antes del middleware (`fsChecker.redirects` precede a la entrada `middleware` en `resolve-routes.js`), y `permanent: true` emite **308**, no 301. | El ordering de U5 es correcto: hacen falta los dos patrones. El status esperado es **308**. |

---

## Unidades

Orden: **U1 → U2 → U3 → U4 → U5.** U3 va antes que U4 a propósito: las filas de `links` tienen que existir en prod *antes* de que las páginas reciban tráfico, o los primeros signups pierden el `link_slug`.

---

### U1 — Capturar atribución en el camino de pago de BROTE

**Boundary.** Es el camino del dinero y la clase de cambio que rompe **en silencio**: si la forma del stash no coincide con lo que el webhook lee, todo sigue verde y la atribución se pierde sin ruido. Va sola aunque sea chica. Además es independiente de las invitaciones — arregla el agujero para *todo* el tráfico de BROTE, incluido el que ya llega por `/go/`.

**Archivos.** `src/app/api/brote/checkout/route.ts` · `src/app/api/brote/webhook/route.ts` · `src/components/BroteCheckoutForm.tsx`

**Cambio.**
- El form lee UTMs de `window.location.search` y el slug de `utm_content` con fallback a la cookie `haris_link`, y los manda en el body — el patrón exacto de `SinergiaLanding.tsx:50-60,167`.
- El checkout llama `buildAttribution({ req, body })` y escribe `source`/`medium`/`campaign`/`linkSlug` **planos** en las dos claves del stash. Confirmado con sonda: el webhook los lee planos (`webhook/route.ts:280-295`) mientras `sinergia-parrafo/checkout/route.ts:156` los anida bajo `attribution:`. Se respeta la forma que el webhook ya espera.
- El webhook pasa `bypassLinkSlug: attribution?.linkSlug` a `recordParticipation`. Confirmado con sonda que `participations.referred_by_person_id` se escribe **sólo** desde `params.bypassLinkSlug` (`community.ts:122-137` → `:265`), nunca desde `attribution.linkSlug`.

**Tests que deben estar rojos antes del fix.**

| id | assertion | rojo hoy porque |
|---|---|---|
| T1.1 | body con `utm.{source,medium,campaign,content}` → el JSON stasheado contiene esos cuatro planos | el stash es `{name,email,phone,locale,eventId,fbp,fbc,ip,ua}` |
| T1.2 | sin utm, con cookie `haris_link=abc` → stash con `linkSlug:"abc"` | ídem |
| T1.4 | el webhook, consumiendo **el string producido por T1.1**, llama `recordParticipation` con `attribution.linkSlug` *y* `bypassLinkSlug` iguales | `bypassLinkSlug` nunca se pasa |

**Pins de no-regresión (verdes hoy, declarados como tales).**
- T1.3 — sin utm y sin cookie, el stash **no** gana claves de atribución.

**[R6] Cortados del alcance, con razón.** Los dos tests que el plan original llamaba T1.5 (linkSlug rancio → participación igual creada, `link_slug` NULL) y T1.6 (`bypass_capacity` respeta/saltea el cap) **ya existen palabra por palabra**: `src/lib/links-db.test.ts:118` y `src/lib/community.test.ts:190,248,292` más `src/lib/override-link.test.ts:96,108,115`. Reescribirlos sería duplicación, y además ninguno toca la frontera que U1 cambia. T1.6 pinchaba encima un efecto inerte para BROTE: la capacity del evento es `null` (`seed-preview.ts:122`: *"capacity null mirrors prod"*) y U3 setea `bypassCapacity: false` en las cinco filas. Cortarlos deja a U1 sin ningún test que dependa de DB: T1.1–T1.3 mockean `@/db`, T1.4 mockea `@/lib/community` para espiar los argumentos de `recordParticipation` — que es exactamente la frontera que U1 cambia.

T1.4 es la que importa: debe consumir el stash **real** que produce el checkout, no un fixture escrito a mano. Un fixture a mano no puede detectar el desajuste plano-vs-anidado, que es el bug real que acecha acá.

**Tabla de candidatos.**

| implementación equivocada | qué assertion la mata | re-corrida contra el código final |
|---|---|---|
| null: se llama `buildAttribution()`, se asigna, nunca se mergea al stash | T1.1, T1.2 | *(a completar)* |
| over-restriction: atribuir sólo si hay `body.utm`, ignorando la cookie → mata a todo visitante de `/go/` | T1.2 | *(a completar)* |
| shape mismatch: anidar bajo `attribution:` como sinergia-parrafo, mientras el webhook lee plano | T1.4 (sólo si consume el stash real) | *(a completar)* |
| over-permission: pasar `bypassLinkSlug` siempre, incluso con atribución ausente | T1.4 | *(a completar)* |
| rename: la assertion mira el contenido observable del stash, no el identificador | — (por construcción) | *(a completar)* |

**Check bloqueante y su downgrade.** El ideal es una compra real punta a punta. Bloqueado por P3. U1 se mergea con este downgrade declarado como hechos numerados en el cuerpo del PR:
1. No hay credenciales de sandbox de MP en ningún scope (P3), así que no se ejecutó ninguna Preference real.
2. La cobertura sustituta es T1.4, que atraviesa la frontera checkout→webhook con el stash real y por lo tanto cubre la falla que un pago real habría revelado.
3. Lo que sigue sin verificarse es que MercadoPago propague la metadata de la Preference al Payment. Es comportamiento documentado de MP y ya se depende de él para `buyer_email`/`buyer_name`, pero **acá no se probó**.
4. Mitigación: la primera compra real en prod se inspecciona a mano (fila de `participations` + `/admin/links`) antes de repartir los links. Va a la checklist del owner.

---

### U2 — Registro de invitaciones y precio autoritativo del servidor

**Boundary.** Sin punto de entrada público todavía: nada enlaza a `?inv=`, así que revertir no cambia comportamiento observable. Separada de U4 a propósito — si las páginas salieran primero, alguien vería $21.450 en la invitación y pagaría $24.750 en el checkout.

**Archivos.** `src/lib/brote-invitations.ts` (nuevo) · `src/lib/brote-invitations.test.ts` (nuevo) · `src/app/api/brote/checkout/route.ts` · `src/app/[locale]/brote/checkout/page.tsx` · `src/components/BroteCheckoutForm.tsx` · **[R1]** `src/app/api/brote/verify-email/route.ts` · `src/lib/email-verification-server.ts` · `src/lib/brote-verification-email.ts`

**[R1] El round-trip del email de verificación pierde `?inv=` — y es el camino probable, no un borde.**
`verificationLinkUrl()` (`src/lib/brote-verification-email.ts:32-42`) arma el CTA del mail como `${baseUrl}/${locale}/brote/checkout?verifEmail=…&verifCode=…&verifName=…` — sin `inv`. El comentario de esa función dice que existe justamente porque "el link abre un contexto de browser fresco (la app de mail), donde nada de lo que la persona ya tipeó sobrevive": ese contexto fresco tampoco tiene la cookie `haris_link`, así que el fallback de `buildAttribution` no rescata nada. El tráfico va del navegador in-app de Instagram a la app de mail. Sin esto, **el comprador invitado paga precio público** y el default `{linkSlug, source:"partner"}` nunca se dispara.
El fix: threadear `invite` desde el body del form (acción `send`) → `verify-email/route.ts` → `requestEmailVerification(email, name, locale, invite)` → `verificationLinkUrl(…, invite)`, que lo agrega a los params.

**Cambio.**

```ts
export type InvitationSlug = "pulso" | "matelab" | "unarbol" | "jose" | "gian";

export interface BroteInvitation {
  slug: InvitationSlug;
  name: string;      // "Pulso"
  handle: string;    // "@pulsoclub.ba"
  kind: "brand" | "artist";
  discountPct: number;   // 35 | 0
  linkSlug: string;      // "inv-pulso"
}

export function getInvitation(slug: string | undefined): BroteInvitation | null;
export function isEarlyBird(now?: Date): boolean;
export function resolveInvitationPrice(inv: BroteInvitation | null, now?: Date): {
  priceRaw: number;          // 21450 | 24750 | 33000 — autoridad del servidor
  priceDisplay: string;
  compareAtDisplay?: string;
  badge: "discount" | "earlybird" | null;
};
export function formatArs(amount: number): string;
export function buildInvitationCheckoutHref(locale: string, slug: InvitationSlug): string;
```

> ### ⚠️ REPLANIFICADO tras `checkout-directo` (2026-08-08)
>
> Esta unidad se escribió contra un checkout que ya no existe. Lo que cambia:
>
> - **[R1] queda ANULADA.** No hay más mail de verificación ni round-trip, así que no hay nada que threadear. `verify-email`, `email-verification-server` y `brote-verification-email` **salen de la lista de archivos**, y T2.8 se borra.
> - **La página de checkout no existe.** `/[locale]/brote/checkout/page.tsx` y `BroteCheckoutForm.tsx` fueron borrados. Sale el paso de leer `?inv=` de `searchParams` y de pasar props de precio: **no hay página intermedia**. Sale también `buildInvitationCheckoutHref` y con él T2.7.
> - **El CTA de la invitación hace lo mismo que el de la landing**: `POST /api/brote/checkout` con `{ invite, eventId, fbp, fbc, locale, ...readBrowserAttribution() }` → `init_point` → redirect. Un solo hop.
> - **`isEarlyBird` ya está centralizado** en `currentTicketPrice()` (`src/data/brote.ts`, del rediseño #54), que comparten la landing y la ruta. `resolveInvitationPrice` lo **consume**, no lo reimplementa — recalcular el early bird a mano es justo la deriva que ese helper existe para evitar. Sale `isEarlyBird` de la superficie pública del módulo nuevo.
> - **[R3] se simplifica**: el guard que la enmienda desarmaba ya fue eliminado por `checkout-directo`. `payment.metadata.invite` se lee sin condición, que era la conclusión igual.
> - **Consecuencia para U4**: la página deja de ser 100% server component. El CTA necesita un island cliente mínimo (un botón que hace el POST y redirige). El resto del árbol sigue siendo server.
>
> Neto: U2 se achica a **registro + resolver + la ruta acepta `invite`**. Menos archivos, menos superficie, mismo objetivo.

El 35% se **deriva** de `broteConfig.ticketPriceRaw`; nada de literales pegados al estilo de `unArbolPriceRaw`.

En el checkout: parsear `invite`, **revalidarlo contra `getInvitation()` en el servidor**, y sacar el precio de `resolveInvitationPrice`. Slug desconocido → precio público, sin error. `title = "BROTE — Entrada (Invitación Pulso)"` para reconciliar en el panel de MP. `metadata: { …, invite: slug }` en la Preference — canal durable, inmune al TTL de 24 h del stash. Si hay `invite` y no vino `linkSlug`, default a `{ linkSlug: inv.linkSlug, source: "partner", medium: "referral", campaign: "brote-invitacion" }` (sondeado: el canal `partner` ya existe en `src/lib/links.ts:50` con ese source/medium exactos).

**[R3] El webhook lee `payment.metadata.invite` sin guard.** El plan original decía "bajo el mismo guard que ya protege `buyer_email`", y eso lo rompía en el camino feliz: ese guard es `if (metaBuyerEmail && stashHolder.source !== "preference")` (`webhook/route.ts:248-259`), y en una compra normal el stash de preference **sí** está, así que la rama nunca corre y `metadata.invite` quedaría NULL en toda compra exitosa — fallando DoD #3 en el camino primario. El guard existe sólo porque el stash *por email* puede pertenecer a otro checkout; `payment.metadata` es propia del pago y no tiene ese riesgo. Se lee **incondicionalmente** y se pasa por `recordParticipation({ metadata: { invite } })` (`RecordParticipationParams.metadata` ya existe, `community.ts:49`, escrito en `:272`). Sin riesgo de pisado por el flag de email posterior: esa actualización es `metadata || '{"emailSent":true}'::jsonb`, un merge de jsonb.

**Tests rojos.**

| id | assertion |
|---|---|
| T2.1 | marca → `21450`, badge `discount`, compareAt `"$33.000"` — **idéntico antes y después del deadline** (se pasa `now` en ambos lados) |
| T2.2 | artista antes del deadline → `24750` badge `earlybird`; después → `33000`, badge `null`, sin compareAt |
| T2.3 | `priceRaw === Math.round(broteConfig.ticketPriceRaw * 0.65)` — falla si alguien cambia el precio y el descuento no lo sigue |
| T2.4 | `getInvitation` rechaza desconocido, `undefined`, `""` y variantes de caso |
| T2.5 | ruta: `invite:"pulso"` → `Preference.create` recibe `unit_price: 21450`; `"jose"` en preventa → `24750`; `"../../etc"` → precio público sin throw |
| T2.7 | `buildInvitationCheckoutHref("es","pulso") === "/es/brote/checkout?inv=pulso"` |
| **T2.8 [R1]** | `verificationLinkUrl(email, code, name, locale, "pulso")` contiene `inv=pulso`; sin invite, no agrega el param. Corre hoy sin DB (el módulo no importa `@/db`). |

**Pins de no-regresión (verdes hoy).**
- **[R5]** T2.6 (un `priceRaw` en el body se ignora) **no puede estar rojo**: sondeado, `priceRaw` es display-only en `BroteCheckoutForm.tsx` (líneas 59/70/129/421), nunca entra al body, y la ruta nunca lee `body.priceRaw`. Es verde hoy y verde después. Se conserva como pin, no como test rojo.

**Tabla de candidatos.**

| implementación equivocada | qué assertion la mata | re-corrida |
|---|---|---|
| null: `getInvitation` exportada, el checkout nunca la llama | T2.5 | *(a completar)* |
| over-restriction: gatear el precio de invitación detrás de `isEarlyBird` → las marcas pierden el descuento el 14/8 | T2.1 (caso post-deadline) | *(a completar)* |
| **[R1]** el `invite` se pasa al checkout pero no al mail de verificación → sólo falla para quien verifica por link | T2.8 | *(a completar)* |
| confiar en el cliente: leer el precio del body | T2.6 (pin) | *(a completar)* |
| rename: la assertion mira el `unit_price` que efectivamente recibe `Preference.create` | — (por construcción) | *(a completar)* |
| `Math.floor` vs `Math.round` en el descuento | **ninguna** — sondeado: `33000 × 0.65 === 21450` exacto, ambos dan lo mismo. Se declara: T2.3 fija la fórmula, no el redondeo. El candidato se vuelve vivo sólo si el precio base cambia a uno no divisible. | n/a |

---

### U3 — Filas de links rastreados y seeder de preview

**Boundary.** Nada de código de runtime; sólo scripts y datos. Independiente y revertible sola.

**Archivos.** `scripts/seed-brote-invitation-links.ts` (nuevo) · `scripts/seed-preview.ts`

**Cambio.** Cinco filas en `links` con slugs estables y legibles (`inv-pulso`, `inv-matelab`, `inv-unarbol`, `inv-jose`, `inv-gian`) — no los que genera `generateSlug`, porque el código necesita un valor fijo al que caer cuando alguien llega por la URL bonita. `channel/source: "partner"`, `medium: "referral"`, `campaign: "brote-invitacion"`, `destination: "/es/brote/invitacion/{slug}"`, `bypassCapacity: false`, `createdBy: "seed-brote-invitations"`. Idempotente, `ON CONFLICT DO NOTHING`, dry-run por defecto y `--execute` para escribir — el envoltorio de `scripts/seed-preview.ts`.

Flags opcionales `--referrer-jose=<email>` / `--referrer-gian=<email>` para poblar `links.referred_by_person_id`, que es lo que estampa `participations.referred_by_person_id`. Sin ellos la atribución vive igual en `link_slug` + `metadata.invite`.

Esto habilita, sin escribir UI nueva: `/go/inv-jose` como link corto con conteo de clicks y cookie de 30 días; la URL bonita atribuyendo por el `linkSlug` del registro; y `/admin/links/inv-jose` mostrando clicks, signups y personas atribuidas — **ese es el conteo para liquidar el fee.**

En `seed-preview.ts`, ensanchar el INSERT de `PARTICIPATIONS` para aceptar `linkSlug`, `attribution` y `referrerEmail` (hoy no escribe ninguno de los tres, y por eso en preview todo link muestra 0 signups y "Personas atribuidas" siempre está vacío). Agregar los 5 `LinkFixture` de canal `partner`, `PersonFixture` para Jose y Gian, y participaciones sobre `preview-brote2` que cubran los tres estados: una atribuida a marca (`priceCents: 2145000`), una a artista (`2475000`, con referrer), y dejar las existentes sin atribución como estado vacío.

**Tests.** Esta unidad **no lleva test unitario**. Un test que afirme el largo del array de fixtures fija una constante, no comportamiento — es vacuo y se corta con esta razón declarada. Su evidencia es el dry-run más la corrida contra preview.

**Check bloqueante.** `--execute` contra la rama de preview de Neon; después `/admin/links` lista los cinco y `/go/inv-pulso` responde 302 con UTMs. **Éste sí depende de `vercel env pull`** (P1) — es el único check del programa que lo necesita.

---

### U4 — Las cinco páginas de invitación

**Boundary.** Es el punto de entrada público. Revertir = las páginas 404ean y el resto queda intacto. Va después de U2 y U3, así que el día que existen ya cobran bien y ya atribuyen.

**Archivos.** `src/components/BroteInvitacion.tsx` (nuevo) · `src/app/[locale]/brote/invitacion/[colaborador]/page.tsx` (nuevo) · `public/brote/ilustraciones/*.png` (4) · `src/dictionaries/{types,es,en}.ts`

**[R2] La página es dinámica, no prerenderizada.** Sondeado: no hay un solo `export const dynamic` ni `revalidate` en ninguna página `.tsx` del repo. Una server component sin API dinámica se prerenderiza en build y se cachea sin revalidate, lo que **congela `isEarlyBird` en el momento del build**: un deploy del 10/8 dejaría `/es/brote/invitacion/{jose,gian}` anunciando `Preventa · $24.750` con `$33.000` tachado durante los 7 días entre el deadline y el evento, mientras el servidor cobra $33.000. Es el mismo bug de "la página dice X, el checkout cobra Y" que la partición U2/U4 dice hacer imposible — y la partición no lo cubre, porque es staleness de render, no de orden. (`brote/checkout/page.tsx` se salva sólo por accidente: lee `searchParams`, lo que lo fuerza a dinámico.)
Por eso: `export const dynamic = "force-dynamic"` en la página, y **sin `generateStaticParams`** (queda sin sentido bajo force-dynamic). Slug desconocido → `notFound()`.

**Cambio.** **Server component sin estado** — el handoff es explícito ("Sin estado runtime… tiene que pintar de una"): nada de `framer-motion`, nada de `useSearchParams`, nada de `"use client"`.

- `robots: { index: false, follow: false }`, OG `og-brote.jpg`, favicon 🌱 — el bloque de `brote/checkout/page.tsx`.
- **Cargar las tres fuentes BROTE localmente** (`Archivo`/`Instrument_Serif`/`Space_Mono` → `--font-brote-archivo|serif|mono`) y envolver, igual que `brote/page.tsx`. Es el paso que las páginas de partner viejas se saltearon, y por eso `font-serif` en `/brote-cima` cae en DM Serif.
- Raíz `background:#EAE3D2; position:relative; overflow-x:hidden; container-type:inline-size` + overlay de grano SVG. Columna `max-width:560px; padding:0 clamp(20px,6cqw,32px)`. **Todos los tamaños con `clamp(min, Ncqw, max)`** como especifica el handoff; sondeado que `container-type`/`cqw` no existen hoy en el repo, esta página los introduce y el `container-type` de la raíz los hace determinísticos.
- Paleta idéntica a `BroteLanding.tsx` (`PAPER #EAE3D2`, `FOREST #3E5226`, `FOREST_60 #78855E`, `FOREST_30 #BBC2A9`, `FOREST_10 #E0E1D2`, `BODY #5C6B45`, `FOREST_HOVER #2E3D1C`), como consts de módulo + `style` inline: es la convención vigente del landing, no los tokens `@theme` (paleta de la edición 1).
- Secciones: encabezado · qué es BROTE · precio · qué incluye · cierre · footer.
- **Franja de datos desde `broteConfig`, no del handoff**: el diseño trae "Sábado / 28 MAR" de la edición 1. Va `Jueves / 20 AGO · Desde / 19:00 · Palermo / CABA`, con `white-space: nowrap` en los valores.
- Bloque de precio en las tres variantes de `resolveInvitationPrice` (`discount` / `earlybird` / `null`).
- **Desvío deliberado del handoff:** los dos CTA van a `buildInvitationCheckoutHref(locale, slug)` **en la misma pestaña**. El handoff pide `target="_blank"` porque asumía un link externo a WhatsApp; abrir un flujo de pago en pestaña nueva desde el navegador in-app de Instagram rompe más de lo que ayuda. El chip de Instagram sí conserva `target="_blank" rel="noopener"`.
- Ilustraciones: copiar los 4 PNG de `~/Downloads/design_handoff_brote_invitacion/assets/ilustraciones/` a `public/brote/ilustraciones/`, servidas con `next/image`, `alt=""` (decorativas).
- Diccionario: `BroteInvitacionDict` nuevo — copy fijo + `collaborators: Record<InvitationSlug, {roleLine, closingLine}>` con el texto aprobado del handoff. Nombre y handle viven en el registro TS, no se traducen. Voseo, sin marcas de género.

**Tests.**

| id | assertion |
|---|---|
| T4.1 | cada `InvitationSlug` tiene `roleLine` y `closingLine` no vacíos en **es y en** |
| T4.2 | `buildInvitationCheckoutHref` produce el href de los cinco slugs |

**[R5]** El plan original afirmaba que `src/dictionaries/dictionaries.test.ts` cubre la paridad es/en automáticamente. **Es falso**: sondeado, ese archivo hardcodea `mentoria` y `now` y no cubre nada genérico. La paridad de *forma* viene del typecheck (`const es: Dictionary`), que no detecta strings vacíos. T4.1 es lo único que cubre no-vaciedad y por eso es obligatorio.

**Tabla de candidatos.**

| implementación equivocada | qué assertion la mata | re-corrida |
|---|---|---|
| null: la página renderiza pero el CTA pierde `?inv=` → **todo se vende a precio público en silencio**, el peor fallo de esta unidad | T4.2 sólo si el componente **usa** el helper; si inlinea un template literal, el test pasa y el bug vive. Se declara: la assertion sola no alcanza, el revisor tiene que verificar el call-site en el diff. | *(a completar)* |
| **[R2]** la página queda estática y congela el precio de preventa | verificación con el reloj del sistema pasado el deadline | *(a completar)* |
| slug desconocido renderiza en vez de 404 | verificación manual (P4: no hay render test) | *(a completar)* |
| las fuentes BROTE no se envuelven → cae en DM Serif, la falla exacta de `/brote-cima` | verificación visual | *(a completar)* |

Por P4 esta unidad se apoya más en revisión que en tests. Se dice explícitamente en el cuerpo del PR en vez de fingir cobertura.

---

### U5 — Retirar las páginas de partner viejas

**Boundary.** Redirects a nivel `next.config` más borrados: radio de impacto propio y distinto de todo lo demás. Última porque tocar el routing mientras se lanza una superficie nueva es innecesariamente arriesgado.

**Archivos.** `next.config.ts` · borrado de `src/app/[locale]/brote-{cima,unarbol}/`, `src/components/Brote{Cima,UnArbol}.tsx`, `src/app/api/brote/{cima,unarbol}/`, `public/logo-cima.png` · `src/dictionaries/{types,es,en}.ts` · `src/data/brote.ts`

**Cambio.** Ambas están muertas: su API devuelve 410 sin condiciones y su copy cita precios de la edición 1. Redirect permanente de `/brote-unarbol` **y** `/:locale/brote-unarbol` → `/:locale/brote/invitacion/unarbol` (P8: los redirects corren antes del proxy de locale, así que hacen falta las dos formas). CIMA se borra sin redirect. Sacar `broteUnArbol`/`broteCima` de los diccionarios y de `types.ts`, y `unArbolPrice(Raw)`/`cimaPrice(Raw)` de `src/data/brote.ts` — sondeado que sólo los referencian las dos rutas 410 que U5 borra, y `/logo-cima.png` sólo `BroteCima.tsx`, así que el set de borrado está completo.

**Tests.** Ninguno. Un test que afirme que `next.config` contiene dos patrones fija config, no comportamiento — vacuo, cortado con esta razón. La evidencia es la verificación por request contra el dev server, y el build (que rompe si quedó una referencia colgada a un dict borrado).

---

## Verificación del programa

1. `npm run lint && npm test && npm run build` verdes **en CI** sobre `main` (P1: CI inyecta `DATABASE_URL_DEV`; localmente los 9 archivos con DB fallan por env y eso es esperado).
2. `npm run dev`: las 5 páginas a 390 px y 1440 px. Chequear que "Gian Bejarano" no desborde, que "20 AGO" no parta en dos, que el tachado inclinado caiga sobre el precio, que la fila 4 de "incluye" sea la invertida y sin borde inferior, y que una role/closing line ausente no deje hueco.
3. Precio server-side: POST a `/api/brote/checkout` con `invite:"pulso"` → `unit_price: 21450`; `"jose"` → `24750`; `"no-existe"` → `24750`.
4. **[R2]** Con el reloj del sistema pasado `broteConfig.earlyBirdDeadline`, `/es/brote/invitacion/jose` renderiza `$33.000`, sin badge y sin precio tachado. (Es el check que detecta el prerender congelado.)
5. **[R1]** Verificar por link de mail: pedir código desde `/es/brote/checkout?inv=pulso`, abrir el CTA del mail, y confirmar que la URL de vuelta trae `inv=pulso` y que el precio mostrado sigue siendo $21.450.
6. **[R3]** Atribución punta a punta contra preview: seedear links, comprar con `?inv=jose`, verificar `link_slug='inv-jose'`, `attribution.source='partner'` y `metadata.invite='jose'`. Repetir borrando `brote:checkout:{preferenceId}` antes del webhook. **`metadata.invite` debe estar poblado en las dos corridas**, no sólo en la del stash borrado.
7. `/go/inv-pulso` → 302 con UTMs, fila en `link_clicks`, cookie `haris_link`.
8. **[R4]** `/es/brote-unarbol` y `/brote-unarbol` → **308**. `/es/brote-cima` → 404.
9. Una compra **sin** `?inv=` sigue funcionando igual (no-regresión del flujo público).

**Post-merge (checklist del owner).** Correr `scripts/seed-brote-invitation-links.ts --execute` contra la rama de prod de Neon *antes* de repartir los links, e inspeccionar a mano la primera compra real (fila de `participations` + `/admin/links`) para cerrar el punto 3 del downgrade de U1.
