# Plan de deploy — varias entradas por email, ANTES del 13/8

Contexto: preventa cierra el **13/8**, evento el **20/8**. El sitio está vivo y
vendiendo. Objetivo: que un mismo email pueda tener más de una entrada, en prod,
ya.

---

## 0. Qué significa exactamente "varias entradas por email"

Son **dos comportamientos distintos**, con riesgo muy distinto. Separarlos es lo
que permite entregar algo seguro esta semana.

| | Comportamiento | Estado hoy en prod | Qué hace falta |
|---|---|---|---|
| **A** | **Recompra**: el mismo email vuelve y compra otra entrada | 🔴 **Bug de plata vivo.** El webhook cae en `!created && !promoted`, **no emite nada**, y te manda "pago recibido sin entrada nueva". La persona pagó y no tiene entrada. | U1 + la rama de recompra del webhook |
| **B** | **Comprar N de una** para amigues, N QR en un mail | No existe | U2 (mail con N QR) + cantidad en checkout/MP + modal |

**A ya está rompiendo hoy.** No es una feature nueva: es que alguien paga y no
recibe nada. Y con la preventa cerrando, es justo cuando más gente compra dos
veces ("me sumo con un amigo").

**Recomendación: dos deploys.** A primero, chico y con superficie mínima. B
después, con más superficie y sin la presión del reloj.

---

## 1. Increment A — recompra (el que va ya)

**Qué toca:** la migración + `addCompanionTickets` (ya en #69) + una rama del
webhook + el helper de ids deterministas.

**Qué NO toca — y es la razón de que sea seguro:**

- ❌ el template del mail (camino N=1 intacto, byte por byte)
- ❌ la landing ni ningún CTA
- ❌ `/api/brote/checkout` ni la Preference de MercadoPago
- ❌ el precio
- ❌ `/brote/success`, la puerta, el contador

Superficie de cambio: **una función nueva + una rama de un `if` en el webhook.**

**Resultado observable:** quien ya tiene entrada y paga de nuevo, recibe una
entrada nueva con su propio QR, en vez de nada. Comprar para 2 amigues = pagar
dos veces por separado. No es la UX final, pero **es la diferencia entre cobrar
y no entregar, y cobrar y entregar.**

## 2. Increment B — comprar N de una

U2 (mail con N QR) + cantidad en checkout/MP + modal en los dos call sites. Se
planifica igual pero se deploya después de A, con A ya estable en prod.

---

## 3. Dossier de la migración: por qué no puede romper nada

`docs/ops/0006-prod.sql` — `DROP INDEX` + `CREATE UNIQUE INDEX … WHERE role <> 'companion'`.

### Verificado, no asumido

| # | Afirmación | Cómo se verificó |
|---|---|---|
| 1 | **Es una relajación, no un endurecimiento.** El índice viejo es único sin condición sobre las mismas columnas; el nuevo lo es sobre un subconjunto estricto. Cualquier fila que satisfacía el viejo satisface el nuevo → **el CREATE no puede fallar por datos preexistentes.** | Comparación con `0000_keen_vermin.sql:132` |
| 2 | **Es un índice, no una constraint** → `DROP INDEX` es el verbo correcto y no da error. | `0000_keen_vermin.sql:132` usa `CREATE UNIQUE INDEX`, no `ADD CONSTRAINT` |
| 3 | **`role` es `NOT NULL`** → ninguna fila se escapa del predicado por semántica de NULL. | `src/db/schema.ts:268` |
| 4 | **Es inerte contra el código que está vivo.** Nada en `main` escribe `role = 'companion'`. | grep sobre `main` |
| 5 | **El código de prod HOY funciona con el índice nuevo.** | **La suite completa de `main` (320/320) corrida contra la branch que ya tiene el índice parcial aplicado.** Ésta es la prueba de orden expand. |
| 6 | **El runbook funciona.** apply → verify `PASS` → rollback → re-apply, cada paso en una sola transacción. | Ensayado punta a punta contra la branch de preview |
| 7 | **No hay ninguna duplicada esperando.** | Pre-flight `GROUP BY person_id, event_id HAVING COUNT(*) > 1` → 0 filas (en preview; **hay que repetirlo en prod**) |

### El único modo de falla real, y cómo se elimina

Si el archivo se aplica **sentencia por sentencia** (splitear por
`--> statement-breakpoint`, o mandarlo por el driver HTTP de `neon()`, que
autocommitea cada request), entre el `DROP` y el `CREATE` la tabla queda **sin
ninguna unicidad** sobre `(person_id, event_id)`. `recordParticipation` es
SELECT-después-INSERT bajo READ COMMITTED, así que en esa ventana entra una
duplicada — y entonces **el `CREATE UNIQUE INDEX` falla**, dejando prod sin el
índice viejo, sin el nuevo, y a medio migrar sobre un sistema de pagos vivo.

**Se elimina con `--single-transaction`.** Sin ventana, no hay duplicada nueva,
y el CREATE no puede fallar (afirmación 1).

### Locks

`DROP INDEX` toma `ACCESS EXCLUSIVE` — bloquea **lecturas** además de
escrituras, incluido el conteo de capacidad dentro de `recordParticipation` — y
espera detrás de cualquier transacción abierta sobre la tabla. La tabla es
chica (decenas–cientos de filas), así que el trabajo son milisegundos; el
riesgo es la **cola de locks**. Por eso el `.sql` abre con
`SET lock_timeout = '3s'`: si está disputado, aborta en vez de encolar el
checkout detrás nuestro. Correr en un rato tranquilo igual.

---

## 4. Runbook

### ⚠️ Antes de nada: NO pullear el env de prod sobre `.env.local`

El `.env.local` de este worktree es un **symlink al del checkout padre**.
`vercel env pull .env.local --environment=production` lo sobrescribiría y a
partir de ahí **cualquier corrida de tests escribiría en la base de
producción**. Pullear siempre a un archivo aparte, usarlo sólo para la
migración, y borrarlo:

```bash
vercel env pull /tmp/.env.prod --environment=production
export PROD_URL=$(grep -E '^DATABASE_URL_UNPOOLED=' /tmp/.env.prod | sed -E 's/^[^=]+=//; s/^"//; s/"$//')
```

### Paso 1 — pre-flight, sólo lecturas

```bash
psql "$PROD_URL" -c "SELECT indexdef FROM pg_indexes WHERE indexname='participations_person_event_unique'"
psql "$PROD_URL" -c "SELECT COUNT(*) FROM participations"
psql "$PROD_URL" -c "SELECT COUNT(*) FROM participations WHERE role = 'companion'"
psql "$PROD_URL" -c "SELECT person_id, event_id, COUNT(*) FROM participations GROUP BY 1,2 HAVING COUNT(*) > 1"
psql "$PROD_URL" -c "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at"
shasum -a 256 src/db/migrations/*.sql
```

**Abortar si:**
- el índice actual **no** es el único sin condición que esperamos;
- la query de duplicadas devuelve alguna fila;
- ya hay filas `companion` (la migración ya corrió);
- el ledger tiene un huérfano con `created_at` ≥ `1786380427385` (el `when` de
  0006) → `drizzle-kit migrate` saltearía 0006 y reportaría éxito. **El check
  del ledger es por timestamp, no por hash** (`pg-core/dialect.js:59-62`), así
  que exit code 0 no prueba nada.

### Paso 2 — aplicar

```bash
psql "$PROD_URL" --single-transaction -f docs/ops/0006-prod.sql
```

### Paso 3 — verificar en la misma conexión

```bash
psql "$PROD_URL" -At -c "
  SELECT CASE WHEN indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%role <> ''companion''%'
         THEN 'PASS' ELSE 'FAIL' END
  FROM pg_indexes WHERE indexname='participations_person_event_unique'"
```

Tiene que decir `PASS`. Después, backfill del ledger para que 0006 figure
aplicada (si no, la próxima migración se confunde).

### Paso 4 — humo, sin deployar nada

El código de prod no cambió todavía. Comprobar que sigue vendiendo:
`/es/brote` carga, y **una compra real chica** emite entrada y manda el mail.
Si algo se rompe acá, es la migración, y el rollback del Paso R1 está abierto.

### Paso 5 — mergear y deployar U1 (#69)

Sigue siendo inerte: nada escribe `companion`. Vercel deploya solo.

### Paso 6 — Increment A

Mergear la unidad de recompra. **Acá se abre la puerta de una sola dirección.**

### Paso 7 — humo de la recompra

Comprar con un email **que ya tenga entrada** para BROTE 2 y confirmar:
entrada nueva emitida, mail con su QR, `/api/brote/counter` +1, y `participations`
con una fila `role='companion'` y `buyer_person_id` seteado.

```bash
psql "$PROD_URL" -c "
  SELECT id, role, status, price_cents, external_payment_id, metadata->>'invite'
  FROM participations WHERE role = 'companion' ORDER BY created_at DESC LIMIT 5"
```

---

## 5. Matriz de rollback

| Momento | ¿Se puede revertir el índice? | ¿Se puede revertir el código? |
|---|---|---|
| Migración aplicada, sin deploy | ✅ `0006-prod-rollback.sql` | n/a |
| U1 deployado, cero companions | ✅ sigue abierto | ✅ libre |
| **Existe ≥1 companion** | ❌ **cerrado** — el índice sin condición falla | ⚠️ revertir U3/U4 sí; **U1 no** |

Las dos asimetrías, explícitas:

- **El índice no se puede volver atrás una vez que hay companions.** El
  rollback correcto a partir de ahí es revertir el **código** que las emite; el
  índice parcial es inofensivo para el código viejo (afirmación 5).
- **No revertir el código de U1 mientras existan companions.** Sin su `ORDER BY`,
  la sonda de fila existente de `recordParticipation` devuelve una fila
  arbitraria de esa persona, y ese id es el anclaje de Redis de todo lo demás.
  Verificado empíricamente: devuelve la companion.

## 6. Criterios de aborto

Parar y no seguir si: el pre-flight no da lo esperado · el `psql` no vuelve en
segundos (lock disputado — el `lock_timeout` aborta solo) · la verificación no
da `PASS` · la compra de humo del Paso 4 no emite entrada.

## 7. Lo que no se puede saber sin prod

El estado real de prod: definición actual del índice, contenido del ledger, y
cantidad de filas de `participations`. No hay connection string de prod en este
checkout. Todo lo de arriba sobre prod es inferencia desde el repo más la branch
de preview. **Esas tres lecturas son el Paso 1 justamente por eso.**
