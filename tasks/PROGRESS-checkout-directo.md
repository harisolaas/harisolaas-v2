# PROGRESS — BROTE checkout directo

Spec: [`docs/plans/brote-checkout-directo.md`](../docs/plans/brote-checkout-directo.md)

**Todo agente spawneado lee este archivo primero.**

## Merged

| Unit | PR | Qué shippeó | Catches notables |
|---|---|---|---|
| — | — | — | — |

## En vuelo

**U1** — rama `brote/u1-ticket-email-helper`. Implementado, verde local
(lint 0 errores, build OK). Candidate table abajo.

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

## Carry-forward / backlog

| Item | Severidad | Tamaño | Trigger |
|---|---|---|---|
| Atribución UTM de BROTE muerta — el webhook lee `checkoutMeta.source/medium/campaign/linkSlug` pero ni la landing ni `/api/brote/checkout` los escriben nunca (verificado en `git log`: nunca existió). Las entradas se registran sin atribución. | Media | S | Antes de la próxima campaña paga |
| Recuperación de pagos sin email de MP vía `brote:orphan-payment:{ct}` (hoy: alerta al admin y no se emite entrada) | Baja | M | Si aparece un caso real |
| `/brote-unarbol` y `/brote-cima` siguen en 410 con precios `STALE` de la ed. 1 | Baja | S | Al reactivar descuentos |
| `src/lib/admin-auth.ts:133` llama `redis.expire(...)`, que el mock de `src/lib/redis.ts` **no implementa**. Con `MOCK_REDIS=1` (ahora el default de la suite) cualquier test que toque ese camino explota. Ningún test lo toca hoy. | Baja | XS | Al testear admin-auth, o agregar `expire` al mock |
| Los 3 call sites del mail de entrada trataban un error de API de Resend (no-throw) como envío exitoso, marcando `emailSent: true` sobre una entrada no entregada — y en el webhook eso suprime el reintento de MP. **Arreglado en U1** (misma revert boundary: U2 construye el reenvío sobre ese flag). | — | — | Done en U1 |

## Dispositions

_(se completa en Landing)_
