# PROGRESS — BROTE multi-entradas

Spec: [`tasks/brote-multi-entradas.md`](./brote-multi-entradas.md)
**Todo agente que se spawnee en este programa lee este archivo primero.**

Worktree: `/Users/haraldsolaas/code/harisolaas-v2/.claude/worktrees/groovy-waddling-map`
Rama: `brote/multi-entradas`, base `main` (`cb08f9f`).
**El sitio está VIVO — no se pushea a main sin "mergealo" explícito del owner.**

---

## Merged

| Unidad | PR | Qué shippeó | Catches notables |
|---|---|---|---|
| — | — | — | — |

## Queue

| # | Unidad | Estado |
|---|---|---|
| U1 | Índice único parcial + `addCompanionTickets` | plan en revisión |
| U2 | El mail lleva N QR | pendiente |
| U3 | El webhook emite N entradas | pendiente |
| U4 | Modal de cantidad + checkout por N (**el interruptor**) | pendiente |
| U5 | Nombre por entrada en `/success` y en la puerta | pendiente |
| U6 | Seeder de preview | pendiente |

Auditoría zero-context de midpoint: después de U3.

## Blocked

| Ítem | Espera | Pedido a / cuándo |
|---|---|---|
| Migración del índice parcial contra la branch de **prod** de Neon | decisión + ventana del owner; va **antes** del deploy de U1 | owner, al mergear U1 |
| Compra real de 2+ en prod (confirma que MP propaga `metadata.qty` de Preference a Payment) | primera compra real post-deploy | owner, checklist final |

---

## Hard-won constraints

Una línea cada uno. Violarlos cuesta un ciclo de PR completo.
Los primeros vienen heredados de los dos programas anteriores sobre esta misma
superficie (`PROGRESS-checkout-directo.md`, `PROGRESS-invitaciones.md`) y ya
costaron su ciclo — no re-descubrirlos.

- **`.env.local` de este worktree es un SYMLINK al del checkout padre**, que
  apunta a **producción**: Redis, token de MercadoPago y sender de Resend
  productivos. `vitest.config.ts` fuerza `MOCK_REDIS: "1"` para toda la suite,
  así que Redis es estructuralmente inalcanzable desde un test. **Resend y
  MercadoPago NO tienen guard equivalente — mockealos explícitamente en cada
  test.** No borrar ni reemplazar el symlink.
- `DATABASE_URL` en ese mismo archivo apunta a la branch **dev** de Neon.
- **En ESTE worktree, 5 tests de webhook fallan con 401 y NO es un rojo real.**
  El `.env.local` symlinkeado trae `MP_WEBHOOK_SECRET` de producción, así que
  `verifySignature` corre de verdad y rechaza los requests sin firmar de los
  tests. CI no setea esa variable (`.github/workflows/ci.yml:55-58` sólo pasa
  `DATABASE_URL*`), así que allá pasan. Verificado: con `MP_WEBHOOK_SECRET=`
  vacío, 20/20 verdes. Para reproducir CI localmente: `MP_WEBHOOK_SECRET= npx vitest run …`
- **Corolario incómodo: toda la cobertura de webhook del repo depende del bug de
  fail-open.** Los tests existentes pasan porque `if (!secret) return true`
  (`webhook/route.ts:72-74`) los deja entrar sin firma. El día que se arregle ese
  HIGH del backlog, 5 tests se rompen de una. **Los tests nuevos de este programa
  firman el request** (HMAC real con un secreto de test) para no heredar la
  dependencia.
- **CI sí corre `npm run db:migrate` contra la branch dev** antes de los tests
  (`ci.yml:43-52`), así que una migración nueva se auto-aplica ahí. El paso
  manual es sólo contra **prod** (Vercel no migra).
- **CI flakea cuando dos corridas se pisan sobre la branch dev de Neon.**
  `maxWorkers: 1` serializa *dentro* de una corrida, no entre dos. Síntoma:
  `CapacityReachedError` en `test-evt-capped` o `23503 ... is still referenced
  from table "participations"`. **Re-correr antes de concluir que es real.**
- El precio sale de `currentTicketPrice()` / `resolveInvitationPrice()`. **No
  recalcular el early bird a mano** — es justo la deriva que esos helpers evitan.
- **No hay `@testing-library/*`** y `vitest.config.ts` sólo incluye
  `src/**/*.test.ts`. **Ningún componente se puede testear con render.**
- `new MercadoPagoConfig({accessToken: undefined})` no tira y `Resend` es lazy —
  por eso las rutas se pueden importar bajo mocks sin env.
- `tsconfig.json` excluye `**/*.test.ts`: `tsc --noEmit` **no** typechequea los
  tests. Los errores de tipo ahí sólo aparecen bajo vitest.
- CI corre `npm run build`, que typechequea las route types de Next.
  `tsc --noEmit` no es equivalente.
- **No tocar `.next` mientras el dev server del owner corre** en el puerto 3000
  — `lsof -i :3000` antes de cualquier `rm -rf .next` o `next build`.
- El webhook de BROTE lee `source`/`medium`/`campaign`/`linkSlug` **planos** en
  el stash de Redis; `sinergia-parrafo/checkout` los anida bajo `attribution:`.
  No copiar el patrón de sinergia-parrafo.
- **Drizzle no re-tira el error de pg, lo envuelve.** `DrizzleQueryError` tiene
  `code: undefined`; el código real vive en `cause`. Ver `isUniqueViolation` en
  `src/lib/brote-contact.ts`.
- **El merge jsonb `||` es shallow** — reemplaza la clave de primer nivel entera.
- **El SDK de Resend no tira ante errores de API** — devuelve `{data, error}`.
  Éxito = sin `error` **y** con id en `data`.

## Carry-forward / backlog

Crece durante la ejecución por diseño.

| Ítem | Severidad | Tamaño | Trigger que lo revive |
|---|---|---|---|
| Webhook de BROTE **falla abierto** sin `MP_WEBHOOK_SECRET` (`webhook/route.ts:72-74`, `if (!secret) return true`). Pre-existente, fuera de alcance. Fix: copiar la forma de `verifySignature` de `src/app/api/sinergia/webhook/route.ts:36-51`. | **Alta** | XS | Decisión del owner — antes del 20/8 |
| **Puerta sin autenticar**: `/api/brote/validate` no tiene auth y `/es/brote/gate` es público; cada QR deep-linkea ahí, o sea un botón permanente de "marcar como usada". Pre-existente. | **Alta** | S | Decisión del owner — antes del 20/8 |
| CI comparte una sola branch dev de Neon sin aislamiento por corrida | Media | M | Cuando vuelva a pasar, o antes del próximo programa multi-PR |
| **Los 5 tests de webhook existentes sólo pasan por el fail-open.** CI no setea `MP_WEBHOOK_SECRET`, así que mandan requests sin firmar y el webhook los deja entrar. Arreglar el fail-open los rompe a los cinco: hay que firmarlos primero (o setear la env en CI). Descubierto acá, al ver 5 rojos locales que en CI son verdes. | Media | S | Va **junto** con el fix del fail-open — quien lo tome arregla los dos |

## Dispositions

*(se completa en la fase de Landing)*
