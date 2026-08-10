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
| **U1** | [#69](https://github.com/harisolaas/harisolaas-v2/pull/69) — abierto | Índice único parcial (`WHERE role <> 'companion'`), `addCompanionTickets`, `ORDER BY` en la sonda de `recordParticipation`, corrección de `docs/specs/01-data-model.md` | **Revisor del plan:** 9 enmiendas vinculantes; 5 eran defectos que se embarcaban (guard de concurrencia removido, payout de colaboradores subcontando 3×, anclajes de la recompra sobre la compra anterior, `sanitizeAttribution` salteado, argumento de inercia falso). **Tabla de candidatos:** M8 sobrevivía — T1.7 pasaba contra el código sin arreglar por suerte del planner. **M2 sobrevive declarada**: el índice NO es lo que deduplica `recordParticipation`; es el row lock de `people` del upsert. |

## Queue

| # | Unidad | Estado |
|---|---|---|
| ~~U1~~ | ~~Índice único parcial + `addCompanionTickets`~~ | **PR [#69](https://github.com/harisolaas/harisolaas-v2/pull/69)** — esperando CI + revisión adversarial. **No mergear sin "mergealo" Y sin la migración manual aplicada en prod primero.** |
| U2 | El mail lleva N QR | pendiente |
| U3 | El webhook emite N entradas | pendiente |
| U4 | Modal de cantidad + checkout por N (**el interruptor**) | pendiente |
| U5 | Nombre por entrada en `/success` y en la puerta | pendiente |
| U6 | Seeder de preview | pendiente |

Auditoría zero-context de midpoint: después de U3.

## Blocked

| Ítem | Espera | Pedido a / cuándo |
|---|---|---|
| ~~Migración del índice parcial contra prod~~ | — | ✅ **APLICADA 10/8 17:0x** — ver Dispositions |
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
- **`recordParticipation` NO deduplica por el índice único: deduplica por el row
  lock de `people`.** Su upsert `ON CONFLICT (email) DO UPDATE` sostiene el lock
  hasta el commit, así que dos signups concurrentes de la misma persona se
  serializan ahí y el segundo cortocircuita en el SELECT. Verificado con DDL
  real: tres transacciones concurrentes **sin constraint alguna** producen una
  fila. Corolario que gobierna U3: `addCompanionTickets` **no toca `people`**,
  así que no hereda esa serialización — los ids deterministas son su única
  protección contra doble emisión.
- **Mutar `schema.ts` NO prueba nada sobre índices.** Drizzle no valida
  definiciones de índice en runtime y los tests pegan contra una base real. Para
  mutar un índice hay que correr DDL de verdad
  (`scratchpad/idx.mjs`, con `trap` de restauración — la branch dev es
  compartida con el CI de todos los PRs).
- **`vitest -t` acepta UN patrón**; varios `-t` no se acumulan, gana el último.
- **`tsx` no lee `.env.local`** (vitest sí) y los alias `@/` no resuelven desde
  fuera del worktree. Para scripts sueltos: `node` + `@neondatabase/serverless`
  por ruta absoluta, y `sql.query(...)` — `sql` es tagged-template-only.
- **`.next` de este worktree es propio** (no el del owner). `lsof -i :3000`
  antes igual, pero borrarlo acá es seguro y es lo único que arregla los
  `TS2307` de `.next/types/validator.ts` sobre rutas borradas en #65.

## Carry-forward / backlog

Crece durante la ejecución por diseño.

| Ítem | Severidad | Tamaño | Trigger que lo revive |
|---|---|---|---|
| Webhook de BROTE **falla abierto** sin `MP_WEBHOOK_SECRET` (`webhook/route.ts:72-74`, `if (!secret) return true`). Pre-existente, fuera de alcance. Fix: copiar la forma de `verifySignature` de `src/app/api/sinergia/webhook/route.ts:36-51`. | **Alta** | XS | Decisión del owner — antes del 20/8 |
| **Puerta sin autenticar**: `/api/brote/validate` no tiene auth y `/es/brote/gate` es público; cada QR deep-linkea ahí, o sea un botón permanente de "marcar como usada". Pre-existente. | **Alta** | S | Decisión del owner — antes del 20/8 |
| CI comparte una sola branch dev de Neon sin aislamiento por corrida | Media | M | Cuando vuelva a pasar, o antes del próximo programa multi-PR |
| **Los 5 tests de webhook existentes sólo pasan por el fail-open.** CI no setea `MP_WEBHOOK_SECRET`, así que mandan requests sin firmar y el webhook los deja entrar. Arreglar el fail-open los rompe a los cinco: hay que firmarlos primero (o setear la env en CI). Descubierto acá, al ver 5 rojos locales que en CI son verdes. | Media | S | Va **junto** con el fix del fail-open — quien lo tome arregla los dos |

## Dispositions

| Ítem | Estado | Evidencia |
|---|---|---|
| Migración 0006 contra prod | **Done — aplicada 10/8** | Pre-flight limpio (índice incondicional, 255 filas, 0 companions, 0 duplicadas, ledger sin huérfano posterior a 0006). Aplicada con `psql --single-transaction -f docs/ops/0006-prod.sql` en **2s**, exit 0. Post: índice parcial vivo, 0006 en el ledger una sola vez, roles intactos (rsvp 118 / attendee 101 / planter 36), 16 entradas BROTE2 antes y después. Humo en vivo: `GET /api/brote/counter` → 200 `{"count":16}`. Ensayado antes punta a punta en preview (apply → PASS → rollback → re-apply) y probado que **la suite de `main` (320/320) pasa contra el índice nuevo** — orden expand verificado, no asumido. |

### Estado del rollback (importante)

El rollback del índice **sigue abierto**: no existe ninguna fila `companion` en
prod todavía, y no puede existir hasta que deploye el código de recompra.
`docs/ops/0006-prod-rollback.sql` es válido hasta ese momento.

**Cuando exista la primera companion, esa puerta se cierra**: a partir de ahí el
rollback correcto es revertir el código que las emite, nunca el índice — y
**nunca el código de U1**, porque sin su `ORDER BY` la sonda de
`recordParticipation` devuelve una fila arbitraria de la persona.
