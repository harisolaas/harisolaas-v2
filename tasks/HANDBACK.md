# Handback — BROTE checkout directo a MercadoPago

Programa ejecutado con el skill `implementation-programme`.
Spec: [`docs/plans/brote-checkout-directo.md`](../docs/plans/brote-checkout-directo.md) ·
Memoria: [`tasks/PROGRESS.md`](PROGRESS.md) ·
Lecciones: [`tasks/lessons.md`](lessons.md)

---

## 1. Qué shippeó

Tres unidades, tres PRs stackeados. **Ninguno mergeado** — el sitio está live
y CLAUDE.md pide aprobación explícita.

| Unit | PR | Qué cambia para una persona real |
|---|---|---|
| **U1** | [#53](https://github.com/harisolaas/harisolaas-v2/pull/53) | Un solo emisor del mail de entrada. **Arregla entregas fantasma:** los tres call sites trataban un error de API de Resend como envío exitoso y marcaban `emailSent: true` sobre una entrada nunca entregada — y en el webhook eso suprimía el reintento de MP, así que la entrada no salía nunca y nadie se enteraba. También fuerza `MOCK_REDIS=1` en la suite, que corría contra el Redis de **producción**. |
| **U2** | [#55](https://github.com/harisolaas/harisolaas-v2/pull/55) | `/brote/success` ofrece confirmar nombre + email + WhatsApp. Opcional. Si el mail confirmado difiere del de MP, la entrada termina llegando ahí — normalmente sin reenvío, porque el webhook todavía no emitió y manda directo a la dirección correcta la primera vez. |
| **U3** | [#56](https://github.com/harisolaas/harisolaas-v2/pull/56) | **El CTA va derecho a MercadoPago.** Se va la página de identidad + verificación por código. También: el pago en efectivo deja de aterrizar en "falló" y cae en una variante "en camino"; y el webhook rechaza pagos que no son de BROTE. |

Merge order obligatorio: **#53 → #55 → #56**. Cada merge re-apunta la base del
siguiente a `main`, y recién ahí corre CI (ver §5).

## 2. Veredicto de cierre

**SAFE TO STOP.** Verificador independiente, 16 claims, todos **HOLDS**.
Cinco confirmados rompiéndolos a propósito y viendo morir el test: manejo de
error de Resend, respuesta ambigua, merge de metadata, `mpPayer` write-once,
y el movimiento del email canónico.

**Nada quedó UNVERIFIABLE dentro del alcance del código.** Las dos propiedades
que sí necesitan producción están booked como checks tuyos, no como claims:

| Necesita | Qué lo resolvería |
|---|---|
| Si MP realmente lleva a quien paga en efectivo al `back_url` de pending (`auto_return:"approved"` solo auto-redirige aprobados) | Un pago real en efectivo |
| El end-to-end completo (BC3) | Un pago real chico en prod |

Caveat acotado que el verificador nombró y no redondeó: si tenés **session
replay** de PostHog activado del lado del servidor, los snapshots quedan fuera
del control de este código. El `sanitize_properties` cubre las propiedades de
los eventos, no el replay.

## 3. DONE — evidencia

| Criterio | Evidencia |
|---|---|
| Ninguna unidad a medias | Cada helper nuevo tiene call sites vivos; `tsc --noEmit` y `next build` limpios |
| Árbol limpio, sin scaffolding | `git status` vacío; sin `zz-*.test.ts`, sin `.orig`/`.rej`; las mutaciones vivieron en el scratchpad |
| Ningún test debilitado | Cero `.skip`/`.todo`/`.only`/`xit`; ningún archivo de test borrado. Conteos reconcilian: 189 → 195 → 218 → **219** |
| Sin migración | `src/db/schema.ts` y `src/db/migrations/` **intactos** en todo el diff. **No hay paso manual contra el Neon de prod** |
| Sin regresión fuera de alcance | `readStashByEmail` quedó **opcional**, no eliminado — `sinergia-parrafo/webhook` y `scripts/backfill-asistente-names.ts` lo siguen usando y siguen cubiertos |
| CI | #53 **verde** (build + lint + test). #55/#56 no pueden correr CI hasta que su base sea `main` |
| `main` intacto | Sigue en `ae7556d`. Nada mergeado |

**Lo que NO tiene cobertura automática, dicho sin vueltas:** el click del CTA
en la landing. No hay infra de tests de componente en el repo (`environment:
"node"`, sin RTL/jsdom) y agregarla era alcance nuevo. Lo cubre el grep BC2
más tu smoke test. Tampoco hay tests de webhook — nunca los hubo — así que el
guard de `metadata.type` está verificado por lectura contra toda la historia
de git, no por ejecución.

## 4. Backlog

Todo esto es **preexistente**. Lo encontró la auditoría zero-context de
midpoint y **no entró a la cola** — no está en la misma revert boundary y no
re-rompe ningún fix. Detalle completo en `tasks/PROGRESS.md`.

| Item | Sev | Tam | Trigger |
|---|---|---|---|
| `/api/brote/validate` sin auth y `/es/brote/gate` público. El QR de cada entrada linkea ahí, así que quien vea un QR ajeno tiene un botón "marcar como usada", permanente | **HIGH** | M | **Antes del 20/8** |
| El webhook de BROTE falla abierto sin `MP_WEBHOOK_SECRET` (los dos de Sinergia ya fueron endurecidos; BROTE, el único que emite entrada paga, quedó afuera) | **HIGH** | S | **Antes del 20/8** |
| Emails con HTML sin escapar: `/api/brote/register` acepta `name` anónimo y lo interpola crudo → mail firmado con DKIM desde tu dominio con cuerpo elegido por terceros | MED-HIGH | S | Próxima campaña |
| Participación `cancelled` → se cobra y no se emite entrada (el webhook lo lee como pago duplicado) | MED | M | Si aparece un caso |
| Idempotencia del webhook no atómica (`get`+`set`; los hermanos usan `SET NX`) y `brote:payment:*` sin TTL | MED | S | Junto con lo anterior |
| La confirmación reescribe la identidad global (`people` es cross-event) — es lo que pediste, pero el efecto se extiende a Sinergia y a todo bulk email | MED | M | Decisión tuya |
| `Bearer ${undefined}` autentica si la env var no está seteada; `CRON_SECRET` no está en `.env.local` ni en el example | MED | XS | Verificar en Vercel |
| Atribución UTM de BROTE muerta — el webhook lee campos que nadie escribe | MED | S | Próxima campaña paga |
| `redis.expire` no existe en el mock → cualquier test que toque `admin-auth.ts:133` explota con `MOCK_REDIS=1` | LOW | XS | Al testear admin-auth |
| Rate limits en memoria son decorativos en serverless | LOW | M | Si hay abuso |
| `ts` del manifest HMAC sin chequeo de frescura; comparación con `!==` en vez de `timingSafeEqual` | LOW | S | Endurecimiento |
| `/es/brote/gate` no está en `robots.ts` ni tiene `noindex` | LOW | XS | Con el fix de auth |
| Límite de intentos del código de verificación no aplica sobre filas `verified` | LOW | S | Si se reactiva |
| Recuperación de pagos sin email de MP (hoy: alerta al admin, sin entrada) | LOW | M | Si aparece un caso |
| `/brote-unarbol` y `/brote-cima` en 410 con precios `STALE` de la ed. 1 | LOW | S | Al reactivar descuentos |

## 5. Checklist tuyo

1. **Smoke test en el preview de #56** — el CTA llevando a MP, y la vuelta a
   `/success` con el bloque de contacto. No puedo clickear desde CLI y es
   justo el camino sin cobertura automática.
2. **Mergear en orden: #53 → #55 → #56.** Después de cada merge, esperá el CI
   del siguiente (recién ahí corre).
3. **⚠️ Conflicto con [#54](https://github.com/harisolaas/harisolaas-v2/pull/54)**
   ("rediseño de la landing desde el primer CTA hacia abajo"). Toca 8 archivos
   que este programa también toca, incluido
   **`src/app/[locale]/brote/checkout/page.tsx`, que U3 borra**, más
   `BroteLanding.tsx`, `api/brote/checkout/route.ts` y los tres diccionarios.
   El que mergee segundo va a conflictuar, y en el caso de la página borrada
   el conflicto es semántico, no textual. **Decidí el orden antes de mergear
   cualquiera de los dos.**
4. **Verificar en el dashboard de MP si hay webhooks a nivel cuenta.** Si los
   hay, un aporte de Sinergia entregado a `/api/brote/webhook` venía emitiendo
   una entrada gratis de $24.750. U3 agrega el guard, pero conviene reconciliar
   participaciones de BROTE cuyo `priceCents` no matchee una tarifa real.
5. **Verificar `CRON_SECRET` en Vercel** — si no está seteado,
   `Authorization: Bearer undefined` autentica `/api/sinergia/send-reminders`,
   que es un disparador de mail masivo.
6. **BC3, post-merge:** un pago real chico. Que la entrada llegue al mail de
   MP; que cambiar el mail en `/success` la haga llegar ahí; que `people.email`
   quede con el confirmado y `metadata.mpPayer.email` con el de MercadoPago.
7. **Decidir sobre los dos HIGH del backlog antes del 20/8.** Son
   preexistentes y no los toqué, pero el evento tiene fecha.

---

Nada de este programa quedó en vuelo. Las tres unidades están implementadas,
revisadas y entregadas; no hay ramas abiertas sin PR, ni trabajo a medias, ni
nada esperando de mi lado. Lo único pendiente es tuyo: el smoke test y los
merges.
