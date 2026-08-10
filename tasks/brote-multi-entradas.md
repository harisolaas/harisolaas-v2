# Programme — BROTE: comprar varias entradas de una (y volver a comprar)

Worktree: `.claude/worktrees/groovy-waddling-map` · rama `brote/multi-entradas`, base `main` (`cb08f9f`).
**El sitio está VIVO — no se pushea a main sin "mergealo" explícito del owner.**

> Revisado por `programme-plan-reviewer` con sondas ejecutadas. **Nueve enmiendas
> vinculantes y tres cortes de alcance aplicados**; están marcadas **[R#]** y
> **[C#]** en el punto donde cambian el plan.

---

## Definition of Done

El programa termina cuando:

1. Las seis unidades U1–U6 están **merged o cortadas** (ninguna a medio aplicar).
2. Una persona puede comprar N entradas (1–10) en un pago desde la landing **y**
   desde las páginas de invitación, y recibe **un** mail con N QR distintos,
   cada uno válido una sola vez en la puerta.
3. Quien ya tiene entrada puede volver a comprar y recibe entradas nuevas — no
   una alerta al admin.
4. El índice único parcial está aplicado en la branch de prod de Neon **antes**
   de que el código nuevo sirva tráfico, y los otros flujos (`rsvp`, `planter`)
   conservan su deduplicación.
5. Una compra de N desde una invitación le paga al colaborador **N** entradas,
   no una (`scripts/brote-collaborator-payout.ts`).
6. `main` verde en todos los checks requeridos; suite y typecheck pasan.
7. Todo loop abierto tiene disposición terminal.

**Fuera de alcance, explícitamente** — si aparece, va al backlog, no a la cola:

- Descuento por cantidad. El precio unitario no cambia con N.
- Reasignar o cancelar una entrada ya emitida ("mi amigo no viene").
- Que cada invitade reciba su propio mail con su propio QR.
- Reescribir el flujo de contacto post-pago de #58 más allá de lo que N>1 obliga.
- `/api/brote/register`, `/brote-unarbol`, `/brote-cima` (retiradas en #65).
- Los dos HIGH pre-existentes: webhook que falla abierto sin
  `MP_WEBHOOK_SECRET`, y la puerta sin autenticar. Backlog del owner.
- Arreglar el aislamiento de CI sobre la branch dev de Neon.

---

## Contexto

Hoy una persona **no puede comprar más de una entrada**. El límite no es una
regla de negocio: es el índice `participations_person_event_unique` sobre
`(person_id, event_id)` (`src/db/schema.ts:304`) más el cortocircuito de
`recordParticipation` (`src/lib/community.ts:207-252`), que ante un
`(persona, evento)` existente devuelve la fila vieja en vez de insertar.

Consecuencia real, hoy, en producción: si alguien paga una segunda entrada el
webhook cae en la rama `!created && !promoted` (`webhook/route.ts:487`), **no
emite nada**, y manda un mail "BROTE: pago recibido sin entrada nueva". La
persona pagó y no tiene entrada.

El evento es el **20 de agosto**; la preventa cierra el **13**. Hoy es 10 de
agosto.

### Decisiones del owner

1. **Un mail con N QR** (no N mails).
2. **Modal de cantidad** al tocar el CTA, default 1.
3. **Nombre por entrada**, opcional, en `/brote/success`.
4. **Recompra permitida**.

### Estado del terreno (verificado el 10/8)

El programa de invitaciones **terminó y está en main** (#57→#66). Dejó
superficie nueva:

- **[R8]** Hay **dos** call sites de fetch a `/api/brote/checkout`:
  `BroteLanding.tsx:553` (un `handleCheckout` que sirve a 3 CTA) y
  `BroteInvitacionCta.tsx:77` (un `handleClick`, renderizado 2 veces desde
  `BroteInvitacion.tsx:468,619`, sobre **una** ruta dinámica). Dos call sites,
  cinco instancias, una ruta — no "seis call sites".
- Los dos guardan **el token pelado** en `CONFIRM_TOKEN_STORAGE_KEY`
  (escrito en `BroteLanding.tsx:576` y `BroteInvitacionCta.tsx:99`; leído sólo
  en `BroteSuccessContact.tsx:56`).
- El precio de invitación lo decide el servidor
  (`resolveInvitationPrice`, `BroteInvitacion.tsx:91`) y **deliberadamente no
  cruza al cliente**: `BroteInvitacionCta` recibe `{cta,loading,error}`,
  `locale`, `invite`, `variant` — sin precio.
- `scripts/brote-collaborator-payout.ts:71-80` liquida por
  `metadata->>'invite' IS NOT NULL` + `isPaid` (`brote-payout.ts:74-76`:
  `externalPaymentId` y `priceCents > 0`).

---

## La restricción central y cómo se levanta

Una entrada tiene que seguir siendo **una fila** de `participations`: el
contador de árboles (`counter/route.ts:11-18`), el "Árbol #N" del mail y el
reporting cuentan filas. Colapsar N entradas en una fila con un campo
`quantity` rompe las tres en silencio — y una entrada = un árbol es la premisa.

**El cambio de schema es un índice único parcial:**

```ts
uniqueIndex("participations_person_event_unique")
  .on(t.personId, t.eventId)
  .where(sql`${t.role} <> 'companion'`)
```

Verificado con sondas por el revisor:

- `drizzle-kit generate` (0.31.10) emite exactamente
  `DROP INDEX … ; CREATE UNIQUE INDEX … WHERE "participations"."role" <> 'companion';`
  y `0006` es el número correcto. La forma `WHERE "tabla"."col"` ya está
  aplicada en prod (`0000_keen_vermin.sql:132-141`, `0005_pink_flatman.sql:18`).
- **`role` no se filtra en ninguna query.** Todos los hits son proyecciones
  (admin) o roles de `admin_users`. Sin check constraint sobre `role`.
- `external_payment_id` lo escribe `recordParticipation` en el insert fresco
  (`community.ts:271`); ningún otro flujo puede colisionar.

### [R1] El índice **es** hoy el guard de concurrencia. Hay que reemplazarlo.

`webhook/route.ts:197` reclama idempotencia con un `redis.get` pelado, sin
claim atómico. El flujo hermano `sinergia-parrafo/webhook/route.ts:198-210`
usa `redis.set(key, PROCESSING, {NX:true, EX:300})` y su comentario nombra
justo lo que BROTE usa en su lugar: *"…o tropezar con el unique de
(person_id, event_id)"*.

Al volver parcial el índice, dos entregas concurrentes del mismo pago
producirían `2 × qty` entradas, dos mails, un contador inflado y crédito doble
al colaborador — porque `onConflictDoNothing({target: id})` no puede deduplicar
filas cuyos ids son `nanoid` frescos por invocación.

**Solución adoptada: ids de companion deterministas.** Se derivan de
`mpPaymentId + índice`, así que dos entregas concurrentes calculan los **mismos**
ids y la segunda es un no-op real a nivel base. Es más fuerte que el `SET NX`
(que expira a los 300s y dejaría pasar un reintento tardío) y no agrega estado.

```ts
// src/lib/brote-ticket-ids.ts
export function companionTicketId(mpPaymentId: string, index: number): string {
  const h = createHash("sha256").update(`${mpPaymentId}:${index}`).digest("hex");
  return `BROTE2-${BigInt("0x" + h.slice(0, 16)).toString(36).toUpperCase().padStart(8, "0").slice(0, 8)}`;
}
```

Consecuencia sobre el helper: `addCompanionTickets` devuelve
`{ createdIds, existingIds }`. Una fila que ya existía **con el mismo id** es
éxito, no faltante — si no, un reintento concurrente dispararía la alerta de
"creadas < pagadas" para siempre.

**Migración manual en prod.** `DROP INDEX` + `CREATE UNIQUE INDEX ... WHERE` en
una transacción, sin tocar datos, tabla chica. Aplicar **antes** del deploy
(orden expand). Vía driver HTTP `neon()` + backfill de
`drizzle.__drizzle_migrations`. **CI sí corre `npm run db:migrate` contra la
branch dev** (`ci.yml:43-52`), así que ahí se auto-aplica.

---

## Unidades

Orden de merge: **U1 → U2 → U3 → U4 → U5 → U6.**

### [R7] Corrección al argumento de seguridad: **U2 y U3 no son inertes.**

El plan original afirmaba que U1–U3 no cambian comportamiento observable. Es
falso y el revisor lo tumbó:

- **U2 reescribe el único camino vivo del mail de entrada**, con cuatro call
  sites, mientras el evento vende. Mitigación: el pin de HTML idéntico a N=1
  (golden capturado antes de tocar nada) y `contentId: "qr"` conservado.
- **U3 embarcaría la recompra por su cuenta.** Con `qty` defaulteando a 1, la
  rama `!created && !promoted` insertaría una companion, mataría la alerta y
  emitiría una entrada — DoD #3, observable, en U3.
  **Corrección: U3 preserva el comportamiento de hoy cuando `qty === 1` y la
  persona ya tiene entrada** (alerta, sin emisión). Todo el camino de qty>1 es
  código inalcanzable hasta U4, porque ningún pago existente lleva `qty > 1`.
  **U4 invierte esa condición** — una línea — y ahí sí la recompra se enciende,
  junto con el modal. Así el cambio observable vive entero en un solo boundary.

**Sólo U1 es genuinamente inerte** (capacidad de schema + helper sin llamadores).

---

### U1 — Índice parcial + `addCompanionTickets`

**Boundary.** Único cambio de schema y único con paso manual en prod.

**Archivos.** `src/db/schema.ts` · `src/db/migrations/0006_*.sql` (generado) ·
`src/lib/community.ts` · `src/lib/brote-ticket-ids.ts` (nuevo) ·
`src/lib/community.test.ts` · **[R5]** `docs/specs/01-data-model.md`

**[R5] U1 SÍ toca `recordParticipation`.** La sonda de fila existente
(`community.ts:207-218`) no tiene `ORDER BY`:

```ts
.where(and(eq(...personId), eq(...eventId))).limit(1)
```

Con el índice parcial, un comprador con `attendee + 2 companion` hace que esto
devuelva una fila **arbitraria**, y `row.status` / `result.participationId`
—que gobiernan la rama de promoción de waitlist y todos los anclajes de abajo—
quedan a criterio del planner de Postgres. Requerido:

```ts
.orderBy(sql`(${schema.participations.role} = 'companion')`, schema.participations.createdAt, schema.participations.id)
```

para que la fila no-companion gane siempre. Además `docs/specs/01-data-model.md:423,485`
afirma "A person has at most one participation per event": esa línea deja de ser
cierta y hay que corregirla — el programa anterior trató ese archivo como la
autoridad de SQL.

**Helper.**

```ts
export async function addCompanionTickets(params: {
  personId: number;
  eventId: string;
  ticketIds: string[];          // deterministas, ver [R1]
  externalPaymentId: string;
  priceCents: number;           // POR ENTRADA, no el total
  currency: string;
  attribution?: AttributionTouch;
  metadata?: Record<string, unknown>;   // incluye `invite` — ver [R3]
}): Promise<{ createdIds: string[]; existingIds: string[] }>;
```

- **[C3]** Sin `referredByPersonId`: es insatisfacible en el único call site.
  `recordParticipation` lo resuelve dentro de su propia transacción desde la
  fila de `links` (`community.ts:118-134`) y **no lo devuelve**
  (`RecordParticipationResult`, `community.ts:64-72`). El webhook no tiene de
  dónde sacarlo sin una query que el plan no especifica.
- **[R4]** Corre `sanitizeAttribution(tx, params.attribution)` **dentro de su
  propia transacción**, igual que `recordParticipation` (`community.ts:110-113`).
  `participations.linkSlug` tiene FK a `links.slug` (`schema.ts:275`): un slug
  rancio de cookie apuntando a un link borrado levanta `23503` **después de
  cobrada la plata**. `linkSlug` sale del `attribution` sanitizado, no se acepta
  suelto.
- Un solo `INSERT ... VALUES (...), (...)` con `role: 'companion'`,
  `buyerPersonId = personId`, `onConflictDoNothing` sobre `id`, `returning id`.
  `existingIds` = pedidos − creados, re-consultados por id para confirmar que
  existen de verdad (y no que el insert falló por otra razón).

**Tests que deben estar rojos antes del fix.**

| id | assertion | rojo hoy porque |
|---|---|---|
| T1.1 | `recordParticipation` + `addCompanionTickets(3)` misma persona/evento → 4 filas, ids en el orden pedido | viola el índice único (23505) |
| T1.3 | **[R1]** dos llamadas **concurrentes** (`Promise.all`) con los mismos ticketIds → 3 filas en total, una tanda en `createdIds` y la otra en `existingIds` | el helper no existe |
| T1.5 | las companion llevan `role='companion'`, `buyer_person_id`, `price_cents` unitario, el `external_payment_id` del pago **y `metadata.invite`** | ídem |
| T1.6 | **[R4]** `attribution.linkSlug` apuntando a un link inexistente → inserta igual con `link_slug` NULL, sin 23503 | ídem |
| T1.7 | **[R5]** persona con `attendee` + companions → `recordParticipation` devuelve **la attendee**, no una arbitraria | hoy no hay `ORDER BY`; imposible de montar sin companions |

**Pins de no-regresión (verdes hoy, declarados como tales).**

- T1.2 — dos `recordParticipation` con `role:'attendee'` misma persona/evento
  siguen devolviendo la fila existente sin insertar.
- T1.4 — un RSVP de Sinergia (`role:'rsvp'`) repetido sigue deduplicando.
  Prueba que el índice parcial no aflojó a los otros flujos.

**Tabla de candidatos.**

| implementación equivocada | qué assertion la mata | re-corrida |
|---|---|---|
| null: el helper existe y se exporta, nunca inserta | T1.1 | *(a completar)* |
| over-permission: `DROP INDEX` sin recrearlo parcial | T1.2, T1.4 | *(a completar)* |
| discriminador invertido: `WHERE role = 'companion'` | T1.1 y T1.2 juntas | *(a completar)* |
| `priceCents` = total en vez de unitario | T1.5 | *(a completar)* |
| ordering: inserta bien pero devuelve `createdIds` desordenado | T1.1 | *(a completar)* |
| **[R1]** ids frescos por invocación en vez de deterministas | T1.3 | *(a completar)* |
| **[R1]** tratar `existingIds` como faltante → alerta eterna | T1.3 | *(a completar)* |
| **[R4]** aceptar `linkSlug` suelto sin sanitizar | T1.6 | *(a completar)* |
| **[R5]** `ORDER BY created_at` solo (la companion puede ser más vieja tras un backfill) | T1.7 | *(a completar)* |

---

### U2 — El mail lleva N QR

**Boundary.** **No es inerte** [R7]: reescribe el único camino vivo del mail de
entrada mientras el evento vende. El pin de N=1 es la mitigación, no un adorno.

**Archivos.** `src/lib/brote-email.ts` · `src/lib/brote-ticket-email.ts` ·
`src/lib/brote-ticket-email.test.ts` · **[R6] los cuatro call sites en tres
archivos**: `webhook/route.ts:539,546` · `confirm-contact/route.ts:181,188` ·
`brote/admin/route.ts:267,274` (resend-email) · `brote/admin/route.ts:611,618`
(gift-ticket)

**Cambio.**

```ts
export interface TicketForEmail { ticketId: string; treeNumber: number; guestName?: string }

sendBroteTicketEmail({ tickets: TicketForEmail[], to, buyerName, paymentId }, sender?)
buildTicketEmailHtml(tickets: TicketForEmail[], buyerName: string): string
markBroteTicketEmailSent(ticketIds: string[]): Promise<void>   // un solo UPDATE ... WHERE id IN
```

- Asunto: 1 entrada → el de hoy; N → `Tus ${N} entradas para BROTE 🌱`.
- **[R6]** El primer adjunto conserva `contentId: "qr"` y los siguientes son
  `qr2..qrN`. Con `qr1..qrN` el HTML a N=1 pasaría a `cid:qr1` y el pin T2.4
  fallaría por construcción — el plan se contradecía a sí mismo.
- Copy cuando N>1: reenviá una a cada persona, o mostralas todas desde tu teléfono.

Se conservan las dos protecciones que costaron un incidente: `error` **y**
`data.id` chequeados antes de resolver, y `emailSent` estampado sólo después
(`brote-ticket-email.ts:88-113`).

**Tests rojos.** T2.1 N=3 → 3 adjuntos y 3 `cid:` **distintos entre sí** ·
T2.2 el asunto pluraliza · T2.3 `markBroteTicketEmailSent(['a','b'])` marca las
dos. **Pin:** T2.4 N=1 produce **exactamente** el golden capturado de `main`
antes de tocar nada (`scratchpad/ticket-email-n1.golden.html`, 3515 bytes).

**Candidatos.** un solo `cid:qr` reusado para los N adjuntos (los clientes
muestran el mismo QR tres veces — la falla más cara y silenciosa; la mata T2.1
comparando los `cid` entre sí) · `IN` armado por concatenación de strings ·
N=1 pluralizado igual · `markBroteTicketEmailSent` que marca sólo el primero.

---

### U3 — El webhook emite N entradas

**Boundary.** Camino del dinero. **[R7]** Inerte sólo porque preserva la rama de
recompra de hoy; el camino qty>1 es inalcanzable hasta U4.

**Archivos.** `src/app/api/brote/webhook/route.ts` · su test

**Cambio.**

1. **Resolver la cantidad, del pago.** `payment.metadata.qty` →
   `payment.additional_info.items[0].quantity` → `stash.qty` → `1`.
   **[C1]** La coerción a entero es **load-bearing, no defensiva**: el SDK lo
   tipa `quantity: number`
   (`node_modules/mercadopago/dist/clients/commonTypes.d.ts:52`) mientras la
   respuesta REST de MP lo devuelve como **string**. Clamp `1..MAX_TICKETS` (10).
   **[C2] El stash NO es una fuente degradada.** Lo escribe nuestra propia ruta
   de checkout *después* del clamp del servidor (`checkout/route.ts:168-197`);
   el cliente nunca lo escribe ni manda precio. Es tan autoritativo como
   `payment.metadata`. La autoridad real contra la que se contrasta es
   `transaction_amount`.
2. **Contrastar contra la plata.** El stash guarda `unitPriceCents` (U4). Si
   `transaction_amount` alcanza para menos entradas que las pedidas, se emiten
   `floor(monto / unitario)` y se alerta. Sin stash, se saltea y se loguea.
3. **Emitir.** `recordParticipation` una vez, después `addCompanionTickets` con
   **ids deterministas** [R1] por el resto:
   - si `created || promoted` → esa es la entrada 1, faltan `qty - 1`;
   - si no (ya tenía entrada) → **`qty` companions**, la vieja no se toca…
     **pero sólo cuando `qty > 1`**. Con `qty === 1` se conserva la rama de hoy
     (alerta, sin emisión) hasta que U4 la invierta [R7].
4. **[R3] `invite` y la atribución van a las companions.**
   `brote-collaborator-payout.ts:71-80` liquida por `metadata->>'invite'`; sin
   esto un 3-pack comprado desde una invitación le paga **una** entrada al
   colaborador. Se pasa `metadata: { invite }` y el `attribution` completo al
   helper — que lo sanitiza y de ahí sale `link_slug`, así `/admin/links/[slug]`
   tampoco subcuenta.
5. `priceCents` **por entrada**: `round(transaction_amount * 100 / qty)`.
6. **[R2] Anclajes en la recompra.** `webhook/route.ts:485` hace
   `ticketId = result.participationId`, que en `!created && !promoted` es la
   fila **vieja** — y `recordParticipation` nunca le actualiza
   `externalPaymentId` (`community.ts:245-252`), así que sigue con el id del
   **primer** pago. Anclar ahí `brote:payment:*`, `brote:confirm:*`, el set del
   mail y el flag `emailSent` haría que el reintento del pago #2 reenvíe el set
   del pago #1, y que `/api/brote/confirm-contact` escriba los nombres de
   invitados sobre las filas de la compra **anterior** — contradiciendo el
   "el token `ct` gobierna sólo las entradas de su pago" de U5. **Requerido: en
   la recompra, anclar todo sobre la primera companion recién creada.**
7. **Reintentos.** El grupo se resuelve con
   `WHERE external_payment_id = $1 ORDER BY created_at, id`.
8. **Números de árbol.** `COUNT(*)` **después** de insertar:
   `treeNumberStart = total - qty + 1`.
9. **La alerta cambia de significado**: `creadas + existentes < pagadas`.

**[R9] Los tests nuevos firman el request.** En este worktree el `.env.local`
symlinkeado trae `MP_WEBHOOK_SECRET` de producción, así que los 5 tests de
webhook existentes dan 401 acá y verde en CI (que no setea la variable). Firmar
con HMAC real y un secreto de test hace la cobertura independiente del bug de
fail-open — que además está fuera de alcance, y cuya "solución obvia" local
sería debilitar `verifySignature`.

**Tests rojos.** T3.1 `metadata.qty=3` → 3 filas + 3 ids al mail · T3.2 qty desde
`additional_info`, **incluido `quantity` como string** [C1] · T3.3 comprador con
entrada previa + qty=2 → 2 filas nuevas, la vieja intacta y sin reenviar, y
**[R2]** los anclajes de Redis sobre la companion nueva · T3.4 el monto alcanza
para 2 con qty=3 → 2 filas + alerta · T3.5 reintento con `emailSent` falsy
reenvía las 3 · **[R3]** T3.7 las companions llevan `metadata.invite`.
**Pins:** T3.6 un pago sin `qty` sigue emitiendo 1 · **[R7]** T3.8 recompra con
`qty=1` sigue alertando y **no** emite.

**Candidatos.** `qty` sin `Math.floor` · reusar la fila existente como entrada 1
en la recompra (T3.3) · `qty` sin clamp superior → `metadata.qty=10000` inserta
10.000 filas · reenviar sólo la primaria en el reintento (T3.5) ·
`treeNumberStart` calculado antes del insert · **[R3]** pasar `invite` sólo a
`recordParticipation` (T3.7) · **[R2]** anclar sobre `result.participationId`
en la recompra (T3.3).

**[C1] Downgrade declarado.** T3.2 maneja un objeto de pago armado a mano: fija
**nuestro parser**, y no dice nada sobre si MP puebla `additional_info.items` en
un pago real de Checkout Pro. Tanto eso como la propagación de `metadata.qty`
de Preference a Payment van a la checklist del owner como **no verificado con un
pago real**.

---

### U4 — Modal de cantidad y checkout por N (el interruptor)

**Boundary.** Primera unidad con efecto observable, y la que **enciende la
recompra** [R7]. Revertirla sola devuelve el sitio al comportamiento de hoy.

**Archivos.** `src/components/BroteQuantityModal.tsx` (nuevo) ·
`src/components/BroteLanding.tsx` · `src/components/BroteInvitacionCta.tsx` ·
**[R8]** `src/components/BroteInvitacion.tsx` ·
`src/app/api/brote/checkout/route.ts` · `src/app/api/brote/webhook/route.ts`
(la línea que invierte la rama de recompra) · `src/lib/brote-confirm-token.ts` ·
`es.ts` / `en.ts` / `types.ts`

**Modal.** Componente propio: **dos** call sites de fetch [R8], cinco instancias
renderizadas. Stepper − / N / +, default 1, tope 10, total en vivo, botón
primario `Ir a pagar · $49.500`. Escape, click fuera, botón; foco atrapado y
devuelto al CTA que lo abrió.

**[R8] El total en vivo en la variante de invitación necesita un prop nuevo.**
`BroteInvitacionCta` hoy no recibe precio — `resolveInvitationPrice` se computa
en el servidor (`BroteInvitacion.tsx:91`) y deliberadamente no cruza al cliente.
Se agrega un prop `unitPrice` (display-only, no autoridad: el servidor sigue
decidiendo lo que se cobra) y se edita `BroteInvitacion.tsx`, que faltaba en la
lista de archivos.

**Checkout.** `body.quantity` → `clampQuantity()`: entero, `1..10`, cualquier
cosa rara cae en 1. Después:

- `items[0].quantity = qty` con `unit_price` **sin tocar**;
- `metadata: { type: "ticket", qty, invite? }`;
- el stash (los dos anclajes) gana `qty` y `unitPriceCents`;
- Meta CAPI `InitiateCheckout` con `value = price * qty` y `num_items`;
- **[R8]** `BroteLanding.tsx:535-545` dispara el `fbq('track','InitiateCheckout',
  {value})` **del navegador** bajo el mismo `eventID` que usa el evento de CAPI.
  Si U4 multiplica sólo el valor del servidor, el par deduplicado queda con dos
  valores distintos. Hay que multiplicar los dos.
- `localStorage` guarda `{ ct, qty }` en vez del token pelado, en **los dos**
  call sites. **Leer el formato viejo (string suelto) como `{ct, qty: 1}`** —
  hay tokens en localStorage de gente que compró esta semana.

**Tests rojos.** T4.1 `quantity: 3` → `items[0].quantity === 3` y
`metadata.qty === 3` · T4.2 tabla de casos `"3"` / `0` / `-1` / `2.7` / `999` /
ausente / `null` → clampeado · T4.3 el stash lleva `qty` y `unitPriceCents` en
los dos anclajes · T4.4 `unit_price` no se multiplica · T4.5 el parser de
localStorage acepta el formato viejo · **[R7]** T4.6 recompra con `qty=1` ahora
**sí** emite. **Pin:** T4.7 sin `quantity` el body de la Preference es el de hoy.

**Candidatos.** multiplicar `unit_price` en vez de `quantity` (MP muestra
"1 × $49.500" y el contraste por monto de U3 pasa igual — sólo la mata T4.4) ·
clamp que acepta `"3"` pero no `3` · escribir `qty` en un solo anclaje (T4.3) ·
modal que no resetea la cantidad al reabrir desde otro CTA · el parser nuevo de
localStorage que tira con el formato viejo y deja sin contacto a quien compró
esta semana (T4.5) · **[R8]** multiplicar el valor de CAPI y no el de `fbq`.

**Hueco declarado.** No hay `@testing-library/*` ni `jsdom`, y
`vitest.config.ts` sólo incluye `src/**/*.test.ts` (verificado por el revisor).
**El modal no se puede probar con render.** Se cubre por: helper puro
`clampQuantity` testeado, tests de la ruta, y verificación manual en navegador
sobre el preview. Se declara, no se disimula.

---

### U5 — Nombre por entrada en `/brote/success` y en la puerta

**Boundary.** Opcional y post-pago: falla sin costar una entrada.

**Archivos.** `src/components/BroteSuccessContact.tsx` ·
`src/app/api/brote/confirm-contact/route.ts` · `src/lib/brote-contact.ts` ·
`src/app/api/brote/validate/route.ts` · `es.ts` / `en.ts` / `types.ts`

**Dónde vive el nombre.** `participations.metadata.guestName`. **No** se crean
filas en `people`: es la tabla de identidad transversal que alimenta cada
audiencia de mail, y un invitado sin email propio no es una identidad.

**Flujo.** El bloque de contacto gana, cuando hay más de una entrada, un campo
por entrada. El `GET` devuelve `tickets: [{id, guestName}]` del grupo (por
`external_payment_id`); el `POST` acepta `guestNames: string[]` **ordenado**, no
un mapa por id — así el camino "todavía no hay entradas" puede parquear los
nombres en Redis y el webhook los aplica en orden de creación. Por eso `qty` va
en localStorage: la UI dibuja los campos sin esperar al webhook, sin polling.

Autorización: el token `ct` gobierna **sólo** las entradas de su pago —
garantizado por [R2], sin el cual el `ct` del pago #2 resolvía las filas del #1.

**Renombrar no reenvía el mail.** El QR codifica el id, que no cambia.

**`email_taken` deja de ser un error.** Al repuntar el grupo hacia una persona
que ya tiene una fila `attendee` para el evento, **la nuestra pasa a
`companion`** y no hay violación. El outcome queda sólo como red para una
carrera perdida (23505). El repunte mueve **todas** las filas del grupo.

**Puerta.** `validate/route.ts` devuelve `metadata.guestName` cuando existe, y
si no el nombre de `people`.

**Tests rojos.** T5.1 `guestNames` en las filas correctas · T5.2 un id de otro
pago no escribe nada · T5.3 email de alguien que ya tiene entrada → aplicado con
demote a `companion`, no 409 · T5.4 el repunte mueve las N filas · T5.5
`validate` prefiere `guestName` · T5.6 nombres parqueados + webhook → aplicados
en orden.

---

### U6 — Seeder de preview

`scripts/seed-preview.ts`. Valores reales (preventa $24.750 → `2_475_000` cents,
general $33.000):

1. compra de 3: 1 `attendee` + 2 `companion`, mismo `external_payment_id`, una
   con `guestName` y otra sin;
2. persona con **dos** grupos de pago distintos (la recompra);
3. compra de 1 sin `guestName` — el camino común;
4. **[R3]** una compra de 2 desde una invitación, con `metadata.invite` en las
   **dos** filas, para poder verificar el payout a mano.

Nota: los `ct` viven en Redis; para recorrer `/success` en preview hay que
sembrar `brote:confirm:{ct}` o imprimir el ct.

---

## Riesgos

| Riesgo | Qué pasa | Mitigación |
|---|---|---|
| **Entregas concurrentes del mismo pago** [R1] | `2 × qty` entradas, dos mails, contador inflado, crédito doble | Ids de companion deterministas: la segunda entrega es no-op a nivel base. |
| **Migración en prod con el evento vendiendo** | Entre `DROP` y `CREATE` no hay unicidad | Una transacción, tabla chica, milisegundos. **Antes** del deploy. |
| **MP no propaga `metadata` de Preference a Payment** | `qty` se pierde → 1 entrada por un pago de 3 | Cascada de tres fuentes; el contraste por monto detecta el faltante y alerta. **No verificado con un pago real** [C1] — checklist del owner. |
| **`additional_info.items` puede no venir** [C1] | Se cae a la tercera fuente | Ídem: no verificado con pago real. El SDK tipa `quantity: number`, REST devuelve string — la coerción es load-bearing. |
| **`qty` la elige el cliente** | Pedir 10 y pagar 1 | La Preference la crea el servidor con precio unitario propio. U3 emite contra lo cobrado. |
| **Se vuelve a meter un paso antes de MP** | El programa anterior sacó cuatro | Modal, no página. Default 1 y botón con foco → un tap extra. |
| **U2 toca el único camino vivo del mail** [R7] | Un bug rompe la entrega de entradas ya vendidas | Pin de HTML idéntico a N=1 contra el golden de `main`. |
| **Un QR reenviado y el amigo no llega** | Nadie puede "desasignar" | Fuera de alcance. Cada fila tiene su `used`. |

---

## Verificación

1. `npm run lint && npm run build && npm test` por unidad.
   **[R9] Baseline de este worktree: `MP_WEBHOOK_SECRET= npx vitest run` → 314/314.**
   Sin limpiar esa variable, 5 tests de webhook dan 401 y **no es un rojo real**.
2. La suite con DB comparte una branch dev de Neon y **flakea si dos corridas se
   pisan** — ante `23503` o `CapacityReachedError`, re-correr antes de concluir.
3. Cada test rojo **por la razón correcta** antes de implementar, y la tabla de
   candidatos re-corrida contra el código final (tercera columna llena).
4. Migración: aplicar contra una branch de preview de Neon primero, verificar que
   el índice tiene su `WHERE`, y que un RSVP de Sinergia repetido sigue
   deduplicando.
5. Preview con el seeder: comprar 3 → un mail con 3 QR distintos → escanear los 3
   → tres `used` independientes → recomprar con el mismo email → 1 entrada más,
   no una alerta. **[R3]** Y `npx tsx scripts/brote-collaborator-payout.ts`
   contando 3, no 1.
6. Modal en navegador sobre el preview: teclado, foco, Escape, mobile.
7. Post-merge en prod: la primera compra real de 2+ se inspecciona a mano
   (`participations` × 2 con el mismo `external_payment_id`, `priceCents`
   unitario, un solo mail con 2 QR).

**Migración manual requerida** contra la branch de prod de Neon, antes del deploy.
