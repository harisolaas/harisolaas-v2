# BROTE — checkout directo a MercadoPago + confirmación de contacto post-pago

Programme spec. Ejecutado con el skill `implementation-programme`.
Memoria de ejecución: [`tasks/PROGRESS.md`](../../tasks/PROGRESS.md).

> **v2** — incorpora las 10 enmiendas binding del plan reviewer y sus 2 cortes
> de alcance. Los cambios respecto de v1 están marcados con **[A#]**.

## Definition of Done

El programa termina cuando:

1. Las tres unidades de abajo están **merged o cortadas** (ninguna a medias).
2. Desde `/es/brote`, un click en el CTA lleva a MercadoPago **sin ningún paso
   intermedio**, y `/es/brote/checkout` devuelve 404.
3. `/es/brote/success` ofrece confirmar nombre + email + WhatsApp, el paso es
   opcional, y un email distinto al de MP termina recibiendo la entrada — sea
   porque el webhook todavía no emitió (camino normal, la manda directo ahí) o
   porque ya emitió (reenvío). **[A6]**
4. Ninguna entrada se emite con `payment.status !== "approved"`.
5. `main` verde en CI (lint + build + test), árbol limpio, sin ramas del
   programa abiertas.
6. Todo lo descubierto en vuelo tiene disposición terminal (Done / Backlog /
   Owner checklist).

**Fuera de alcance** (va al backlog, no a la cola): reactivar `/brote-unarbol`
y `/brote-cima`; arreglar la atribución UTM de BROTE; recuperación de pagos sin
email de MP; escrituras a Redis desde el seeder; cualquier cambio de schema.

## Contexto

El PR #47 (`87adfe5`) metió identidad verificada **antes** del pago: página
`/[locale]/brote/checkout` con nombre + email + código de 6 dígitos + WhatsApp.
Cuatro pasos antes de poder pagar. Volvemos al flujo directo y movemos la
captura de identidad a después del pago, como paso opcional.

Regla que ordena el diseño (decisión del owner): **el email confirmado en
`/success` es el bueno** — pasa a ser el `people.email` canónico. El de MP se
conserva flaggeado como tal.

Estado real del dato (CLAUDE.md está desactualizado): las entradas viven en
`people` + `participations` (Postgres), no en Redis.

## Prerequisitos verificados

| Prerequisito | Estado |
|---|---|
| `gh` autenticado (harisolaas) | ✅ |
| Suite local corre | ✅ vía symlink a `../../.env.local` (~140s) |
| CI: lint + build + test | ✅ `.github/workflows/ci.yml` |
| Cambio de schema | ❌ ninguno — **no hay migración manual en prod** |
| **`.env.local` apunta a PROD** | ⚠️ MP token `APP_USR-`, Resend real, **Redis de producción** (105 `brote:payment:*` vivos). Ver §Seguridad de tests. |

## Seguridad de tests **[A5]**

Constraint binding para todas las unidades:

- `vitest.config.ts` fuerza `MOCK_REDIS: "1"` para toda la suite. Sin eso los
  tests escriben en el Redis de producción durante la venta activa. Es
  estructural, no algo que cada test recuerda. **Entra en U1.**
- Cualquier test que toque el envío de entradas **mockea el módulo de email**
  (`vi.mock("@/lib/brote-ticket-email")`). `.env.local` tiene `RESEND_API_KEY`
  real y `RESEND_FROM_EMAIL="brote@harisolaas.com"`: sin mock se manda correo
  real desde el remitente de producción.
- El mock de Redis (`src/lib/redis.ts`) implementa
  `get/set/incr/sAdd/sRem/sMembers/del/keys` y **no tiene `expire`**. Ningún
  diseño nuevo puede depender de `INCR` + TTL. **[A7]**

## Unidades

### U1 — Extraer `sendBroteTicketEmail()` + blindar la suite

**Boundary:** refactor puro + cambio de test-infra. Sin cambio de
comportamiento en producción. Revertible solo.

Los tres call sites (`webhook/route.ts:~408`, `admin/route.ts:~270`
`resend-email`, `admin/route.ts:~644` `gift-ticket`) **no son idénticos**
**[A1]**:

| | webhook | admin resend | admin gift |
|---|---|---|---|
| cliente Resend | singleton `getResend()` | `new Resend()` por llamada | `new Resend()` |
| tree number | `db.select(count)` inline, `?? 1` | `countBroteTickets()`, `?? 0` | `countBroteTickets()` |
| errores | `try/catch`, **traga** | propaga al 500 | propaga |
| retorno | ninguno | `result.data?.id` → `resendId` en la respuesta | `result.data?.id` |

Por lo tanto el helper **devuelve el id de Resend y NO traga errores** — el
`try/catch` se queda en el caller (el webhook). Si tragara, la acción
`resend-email` del admin empezaría a devolver `{ok:true, resendId: undefined}`
para envíos fallidos, que es justo el modo de falla que esa herramienta existe
para descartar.

El spread `...participationMetadata` del webhook es inerte (verificado: es `{}`
en el camino nuevo y un re-write de la propia metadata vía merge `||` en el
reintento), así que unificar en `{emailSent:true}` es seguro.

**Tests en rojo primero:** `to`, subject, `contentId:"qr"`, id de Resend
devuelto, y que un fallo de Resend **propaga** (no se traga).

### U2 — Confirmación de contacto post-pago (aditivo)

**Boundary:** aditivo. Ninguna ruta viva cambia de comportamiento; el checkout
verificado sigue funcionando. **[A8]** El cambio de `back_urls.pending` se movió
a U3 justamente para que esto siga siendo cierto.

#### Transporte del token `ct` **[A3]**

El plan original asumía que MP devuelve `external_reference` en el query string
del back_url. **Eso no está probado por este repo**: Sinergia solo prueba que MP
lo propaga al objeto Payment (server-side), y ninguna landing de vuelta lee
query params más allá de `payment_id`. No colgamos el mecanismo de una
suposición sin verificar. Diseño final:

- **Primario — `localStorage`.** `/api/brote/checkout` devuelve
  `{ init_point, confirmToken }`; el cliente hace
  `localStorage.setItem("brote:ct", ct)` **antes** de redirigir a MP. Al volver
  a `/success` (mismo browser, mismo origen) lo lee de ahí. Cero supuestos
  sobre MP.
- **Secundario — `external_reference` del query string**, si viene. Sirve
  cuando el `localStorage` se perdió.
- **Server — `external_reference: ct` en la Preference**, que es lo que el
  **webhook** lee (`payment.external_reference`). Ese camino sí está probado
  por Sinergia.
- Si no hay `ct` por ninguna vía, el bloque de confirmación no se renderiza y
  `/success` queda exactamente como hoy.

#### Cambios

- `checkout/route.ts`: `const confirmToken = nanoid(21)`,
  `external_reference: confirmToken`, `confirmToken` dentro del stash
  `brote:checkout:{preferenceId}` (TTL a 7d), y devolverlo en el JSON.
- `webhook/route.ts`:
  - lee `brote:pending-contact:{ct}` **antes** de resolver identidad — gana
    sobre MP;
  - escribe `brote:confirm:{ct}` = ticketId **en todos los caminos donde el
    ticketId se conoce**, incluyendo el fast-path de reintento (`:187`) y el
    de duplicado (`:389`), no solo después de crear la participación **[A6]**;
  - sigue saliendo temprano si `status !== "approved"`.
- `src/lib/brote-contact.ts` (nuevo): `applyBroteContactConfirmation()` — ver
  §Identidad.
- `src/app/api/brote/confirm-contact/route.ts`: `GET ?token=` (prefill),
  `POST {token,name,email,phone}`. Sin auth de sesión: el token **es** la
  autorización. Rate limit 5/IP/60s.
- `/success`: `BroteSuccessContact.tsx` + copy nuevo en `BroteDict.success`
  (es/en).

#### El camino normal es "todavía no hay ticket" **[A6]**

El webhook es asíncrono y el redirect de MP es inmediato, así que cuando la
persona llega a `/success` lo habitual es que **la entrada todavía no exista**.
Eso no es el caso borde del pago en efectivo: es el caso modal.

- `POST` sin ticket → guarda `brote:pending-contact:{ct}` (TTL 7d), responde
  `{ pending: true }`. El webhook lo consume y manda la entrada **directo al
  email confirmado, la primera vez**. No hay reenvío porque no hizo falta.
- `POST` con ticket → aplica y reenvía si el email cambió.
- `GET` sin ticket → `{ found: false }`, el form arranca vacío.

### U3 — Sacar la fricción pre-pago

**Boundary:** la unidad riesgosa, revertible sola. Va **después** de U2 para que
nunca exista una ventana sin captura de identidad.

- `BroteLanding.tsx`: `handleCheckout()` vuelve a `fetch("/api/brote/checkout")`
  → guarda `ct` en `localStorage` → `init_point`. Vuelven el `eventId` de dedup,
  `fbq InitiateCheckout` y las cookies `_fbp`/`_fbc`.
- `checkout/route.ts`: fuera validación de name/email/phone, pre-check de
  duplicado (409), `consumeEmailVerification` (403), `payer`,
  `metadata.buyer_*` y la clave `brote:checkout-by-email:*`.
  `back_urls.pending` → `/success?state=pending` **[A8]**.
- `webhook/route.ts`: eliminar el bloque de precedencia
  `payment.metadata.buyer_email` / `buyer_name` y su guard
  `stashHolder.source !== "preference"` (`:248-260`) — queda código muerto que
  igual type-checkea. **Consecuencia a documentar en el PR: se va la última
  fuente de email que no es `payer.email`, así que el camino "no buyer email"
  (alerta al admin, `:281`) se vuelve materialmente más probable.** **[A10]**
- `src/lib/mp-buyer-info.ts`: fuera `readStashByEmail` y la rama
  `stash-by-email`; actualizar `mp-buyer-info.test.ts`.
- **Borrar:** `src/app/[locale]/brote/checkout/page.tsx`,
  `src/components/BroteCheckoutForm.tsx`,
  `src/app/api/brote/verify-email/route.ts`, `BroteCheckoutDict` + clave
  `broteCheckout` en `types.ts`/`es.ts`/`en.ts`, fixtures
  `EMAIL_VERIFICATIONS` del seeder.
- **Conservar** (decisión del owner: borrar UI, conservar la lib):
  `src/lib/email-verification-server.ts`, su test, **y
  `src/lib/brote-verification-email.ts`** — el lib lo importa
  (`email-verification-server.ts:6`) y su test lo `vi.mock`ea, así que borrarlo
  rompe el build y el test que se decidió conservar. v1 era contradictorio en
  esto. **[A2]** También se conservan la tabla `email_verifications` y la
  migración 0005 — cero migración destructiva.
- `qr-checkout/route.ts`: `302 → /es/brote?src=qr`.

**Tests en rojo primero:** `mp-buyer-info` sin la rama por email; el checkout
acepta un POST sin identidad y devuelve `init_point` + `confirmToken`.

## Identidad — `applyBroteContactConfirmation()`

En `src/lib/brote-contact.ts`. **Recibe `eventId` como parámetro**, no cierra
sobre `BROTE_EVENT_ID`: el evento real no existe en la branch Neon dev, así que
cerrar sobre él haría los tests imposibles sin insertar el evento vivo en una DB
compartida. **[A4]**

En transacción:

1. Siempre escribe en `participations.metadata`:
   `contact: {name,email,phone,confirmedAt}` y
   `mpPayer: {email,name,source:"mercadopago"}` ← el flag pedido por el owner.
2. Email confirmado **igual** al de la person → pisa `phone`, y `name` solo si
   era el placeholder `"Asistente"`.
   Los literales autoritativos del placeholder están en **`community.ts:165` y
   `community.ts:488`** (SQL crudo, no importan la constante); `DEFAULT_BUYER_NAME`
   en `mp-buyer-info.ts:46` solo lo documenta. **[A9]**
   **Divergencia deliberada a documentar:** `recordParticipation` trata el
   teléfono como sticky (`phone = COALESCE(people.phone, EXCLUDED.phone)`,
   `community.ts:170`); acá la confirmación explícita **pisa**. Es intencional —
   la persona acaba de tipear ese número — y hay que decirlo en el código para
   que quien compare los dos no lo lea como bug. **[A9]**
3. Email **distinto**:
   - `UPDATE people SET email = <nuevo>` en la misma fila (preserva
     `first_touch`, atribución e id), **atrapando la violación de unique**
     `people_email_unique` en lugar de confiar en un chequeo previo — el
     check-then-update no es atómico a READ COMMITTED contra un
     `recordParticipation` concurrente **[A4]**;
   - si la violación ocurre → ya existe otra person con ese email: re-apunta
     `participations.personId` a esa fila;
   - si eso viola el unique `(person_id, event_id)` → esa person ya tiene
     entrada: no toca nada, devuelve `email_taken`.
4. Reenvío: si el email cambió, o si `emailSent` es falsy, manda vía
   `sendBroteTicketEmail()` y escribe `metadata.emailResentTo`.
   Tope anti-mailbomb: `metadata.contactResendCount` (máx 3) **en la
   participación**, no en Redis — el mock no tiene `expire` y `INCR` no setea
   TTL, así que un contador Redis con TTL no es expresable. **[A7]**

## Claves Redis

| Clave | Valor | TTL | Estado |
|---|---|---|---|
| `brote:confirm:{ct}` | ticketId | 7d | nueva (U2) |
| `brote:pending-contact:{ct}` | `{name,email,phone,confirmedAt}` | 7d | nueva (U2) |
| `brote:checkout:{preferenceId}` | + campo `confirmToken`, TTL 24h→7d | 7d | se extiende (U2) |
| `brote:checkout-by-email:{email}` | — | — | **se elimina** (U3) |
| `brote:payment:{mpPaymentId}` | ticketId | — | sin cambios |

`brote:confirm-pref:{ct}` y `brote:confirm-count:{ct}` de v1 se eliminan del
diseño: el primero no lo usa nadie (el webhook resuelve por
`payment.external_reference`), el segundo no es expresable con el mock **[A7]**.
Opciones de TTL en mayúscula: `{ EX: n }`.

## Chequeos binding pre-merge

- **BC1** — `npm run lint && npm run build && npx vitest run` verde local antes
  de cada PR; CI verde antes de cada merge.
- **BC2 (U3)** — grep que confirme que ningún link interno queda apuntando a
  `/brote/checkout`. Hits de prosa esperados y **ignorables**: `CLAUDE.md:338,394`,
  `docs/specs/01-data-model.md:104,852`, `docs/plans/brote-verified-email-checkout.md`
  (plan superseded). **[A10]**
- **BC3 (post-merge, owner)** — pago real chico en prod: la entrada llega al
  email de MP; confirmar otro email en `/success` la hace llegar ahí;
  `people.email` queda con el confirmado y `metadata.mpPayer.email` con el de
  MercadoPago. Checklist del owner, no bloquea merge.
- **BC4 (pre-U2, informativo)** — capturar la URL de vuelta completa de un pago
  real para registrar si MP manda `external_reference` en el query. **No es
  bloqueante**: el diseño ya no depende de eso (`localStorage` es el primario).
  El resultado solo dice si el fallback secundario sirve. **[A3]**

## Riesgos aceptados

| Riesgo | Mitigación |
|---|---|
| MP no devuelve email | Se mantiene la alerta al admin. U3 lo vuelve **más probable** al sacar `metadata.buyer_*` — documentado en el PR. Recuperación automática: backlog. **[A10]** |
| Pago en efectivo / pendiente | `back_urls.pending` → `/success?state=pending` (U3); contacto guardado 7d y aplicado al acreditarse. **Nunca se emite entrada con status pendiente.** Si MP auto-redirige o exige click en "volver al sitio" **no es verificable desde el código**. |
| Cierra la pestaña antes de `/success` | Aceptado: la entrada ya salió al email de MP. |
| `localStorage` vacío (otro dispositivo, storage limpiado) | Fallback a `external_reference` del query; si tampoco, el bloque no se muestra y queda el fallback de WhatsApp. |
| Se pierde el pre-check de duplicado | El webhook detecta `!created && !promoted` y alerta al admin. |
| Token `ct` filtrado | No adivinable (nanoid 21), TTL 7d, tope de 3 reenvíos, nunca viaja por email. |
| QR ya emitido y cambia el email | El `ticketId` no cambia; el QR viejo sigue válido. Se dice en el copy. |

## Cortes de alcance (del plan review)

- **Test de ausencia de `broteCheckout` en `dictionaries.test.ts`** — cortado.
  El archivo no enumera claves top-level (solo camina `mentoria` y `now`), así
  que el borrado lo prueba `npm run build`, no un test. Un test que asegura la
  ausencia de una clave es pinchar una deleción que el typecheck ya prueba.
- **Fixtures de participaciones BROTE en el seeder** — cortado. El seeder es
  solo-Postgres y siembra `preview-brote`/`preview-brote2`, nunca
  `BROTE_EVENT_ID`; cada rama del bloque de confirmación depende de claves
  Redis que el seeder no puede producir. Como estaba especificado, el trabajo
  era inerte. Se mantiene únicamente la **remoción** de `EMAIL_VERIFICATIONS`.
