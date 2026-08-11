# HANDBACK — BROTE: varias entradas por compra

Programa cerrado el **11/8/2026**. Spec: [`brote-multi-entradas.md`](./brote-multi-entradas.md) ·
Memoria: [`PROGRESS-multi-entradas.md`](./PROGRESS-multi-entradas.md)

---

## 1. Qué shippeó

**La feature está viva en producción.** Una persona puede comprar hasta 10
entradas en un pago y recibe todos los QR en un solo mail. Y quien ya tenía
entrada puede volver a comprar.

| Unidad | PR | Cambio que un humano tiene que saber |
|---|---|---|
| **U1** | [#69](https://github.com/harisolaas/harisolaas-v2/pull/69) | El unique de `(person_id, event_id)` es **parcial** (`WHERE role <> 'companion'`). Una persona puede tener varias entradas para un evento; las extra son filas `companion` con `buyer_person_id`. Sinergia, plantaciones y la entrada propia del comprador conservan la unicidad completa. **Requirió migración manual en prod.** |
| **U2** | [#75](https://github.com/harisolaas/harisolaas-v2/pull/75) | El mail lleva N QR, cada uno con su propia URL de puerta y su propio adjunto. El mail de **una** entrada quedó byte a byte igual. De paso, el template ahora escapa lo que viene del usuario. |
| **U3** | [#76](https://github.com/harisolaas/harisolaas-v2/pull/76) | El webhook emite N. La cantidad sale del pago y **se contrasta contra el monto cobrado**: si la plata no alcanza, emite lo que cubre y alerta. `price_cents` pasó a ser **por entrada** (antes era el total). |
| **U4** | [#77](https://github.com/harisolaas/harisolaas-v2/pull/77) | **El interruptor.** Modal de cantidad en los 3 CTA de la landing y en las páginas de invitación. Y **la recompra encendida**: quien ya tenía entrada y paga de nuevo recibe entradas, no una alerta. |
| **U5** | [#78](https://github.com/harisolaas/harisolaas-v2/pull/78) | Nombre por entrada, opcional, en `/brote/success`. **La puerta muestra ese nombre**, no el de quien pagó. |
| **U6** | [#79](https://github.com/harisolaas/harisolaas-v2/pull/79) | El seeder de preview cubre compra múltiple, recompra e invitación multi-entrada. |

**PRs de sostén:** [#80](https://github.com/harisolaas/harisolaas-v2/pull/80) (import sin usar) ·
[#81](https://github.com/harisolaas/harisolaas-v2/pull/81) (lessons) ·
[#82](https://github.com/harisolaas/harisolaas-v2/pull/82) (**arreglo de regresión**, ver §2) ·
[#83](https://github.com/harisolaas/harisolaas-v2/pull/83) (cerca de tests).

### Lo que cambió y no se ve

- **CI corre serializado** (`concurrency: ci-shared-neon-branch`). Nueve PRs
  abiertos compartían una branch de Neon y las corridas se pisaban; ya le había
  costado un ciclo de debug a **tres** programas distintos.
- **El orden canónico de una compra** vive en `purchaseOrder`
  (`src/lib/brote-guest-names.ts`) y lo usan los tres lectores de un grupo. No
  es cosmético: de él cuelga qué nombre va en qué entrada.

---

## 2. La regresión que encontró el verificador de cierre

El programa **introdujo un bug de doble emisión** y lo arregló antes de cerrar.
Vale registrarlo entero porque es el tipo de falla que este proceso existe para
atrapar.

`created` solo decidía cuántas companion debía todavía un pago. Dos entregas
concurrentes de MercadoPago del **mismo** pago calculaban secuencias de ids de
**largos distintos** — A pedía `C0…C(qty-2)`, B (viendo la fila recién creada
por A) pedía `C0…C(qty-1)`. `ON CONFLICT` deduplicaba el prefijo compartido,
pero el último id que nadie más reclamó **insertaba**.

Con **qty=1**, la compra común: dos entradas válidas por un pago, dos mails,
contador inflado, crédito doble al colaborador. Y en silencio — la alerta sólo
dispara al emitir de **menos**.

**Nadie fue afectado:** producción tiene **0 filas companion**. Ninguna compra
múltiple real llegó todavía, así que la carrera nunca se disparó.

El arreglo cambia la pregunta de *"¿creé yo esta fila?"* a *"¿esta fila es de
ESTE pago?"*, leído de `external_payment_id`, que `recordParticipation` nunca
pisa en una fila que sólo encontró.

---

## 3. Veredicto de cierre

**SAFE TO STOP** (`programme-closing-verifier`, segunda pasada tras el arreglo).

| Claim | Veredicto |
|---|---|
| U1 índice parcial + companions | **HOLDS** |
| U2 un mail con N QR, N=1 idéntico | **HOLDS** — el verificador reconstruyó el template pre-U2 y diffeó contra el golden: byte a byte |
| U3 el webhook emite N | **HOLDS** |
| U4 modal + cobro × N + recompra | **HOLDS** |
| U5 nombre por entrada | **HOLDS** |
| U6 seeder | **HOLDS** |
| Ningún camino emite de más | **HOLDS** — tras #82 |
| Dos entregas concurrentes no duplican | **HOLDS** — tras #82 |
| Orden canónico compartido | **HOLDS** |
| **Migración 0006 viva en prod** | **UNVERIFIABLE HERE** por el verificador (no tiene credenciales). **Confirmada por mí, read-only:** índice parcial vivo, 0 companions, 1 fila en el ledger. |

El verificador construyó su propia reproducción de la carrera y **la validó
re-aplicando mi código pre-arreglo** antes de confiar en ella. Esa es la parte
que hace creíble el veredicto.

---

## 4. Assertion de DONE, con evidencia

| Criterio | Evidencia |
|---|---|
| Las seis unidades merged | #69 #75 #76 #77 #78 #79 — todas `MERGED` |
| Ningún PR del programa abierto | `gh pr list` filtrado por `brote/` → vacío |
| Nada a medio aplicar | Cada helper tiene call site; cada migración, su código |
| `main` verde | run del commit `7581ced` → success |
| App desplegada sirve | `/es/brote` → 200 · `counter` → `{"count":16}` |
| Suite y typecheck locales en main | **487/487**, `tsc` limpio, eslint **0 errores** |
| Árbol de trabajo limpio | `git status --porcelain` vacío |
| Sin andamiaje en el repo | grep de `zz-`/`.orig.`/`scratch`/`mutate` → nada |
| Sin tests skippeados | grep de `.skip`/`.todo` → nada |

---

## 5. Backlog

| Ítem | Severidad | Tamaño | Trigger |
|---|---|---|---|
| **Webhook falla abierto sin `MP_WEBHOOK_SECRET`** (`webhook/route.ts:143`, `if (!secret) return true`). Preexistente. Fix: copiar la forma de `verifySignature` de `sinergia/webhook`. **Ojo:** arreglarlo rompe 5 tests de webhook viejos que pasan *por* el bug (CI no setea la variable). Los tests nuevos de este programa firman el request y no se ven afectados. | **Alta** | XS (+S por los tests) | Decisión del owner — **antes del 20/8** |
| **Puerta sin autenticar**: `/api/brote/validate` no tiene auth y `/es/brote/gate` es público; cada QR deep-linkea ahí, o sea un botón permanente de "marcar como usada". Preexistente. | **Alta** | S | Decisión del owner — **antes del 20/8** |
| `email_taken` sigue devolviendo 409 al confirmar un mail que ya tiene entrada. El spec quería degradar a companion y repuntar; **cortado a propósito** — fusionaría las compras de dos personas bajo una identidad. La razón está escrita al lado del código. | Media | M | Si alguien se queja de no poder corregir su mail |
| **Copy con género en la landing**: el bloque 01 del line up dice "si venís solo/a". `CLAUDE.md` lo prohíbe. Preexistente, fuera del boundary. | Baja | XS | Próximo PR que toque copy de la landing |
| El modal de cantidad no tiene cobertura de render (no hay `@testing-library`/`jsdom`). Se cubre con helper puro + tests de ruta + verificación manual en navegador. | Baja | M | Si se agrega infraestructura de render tests |
| El reintento del webhook duplica la query del grupo en vez de llamar a `ticketsForPayment`. Usa la misma constante `purchaseOrder`, así que no puede derivar en silencio, pero ese call site no está fijado por un test propio. | Baja | XS | Si el orden vuelve a cambiar |

---

## 6. Checklist del owner

| Acción | Trigger |
|---|---|
| **Decidir sobre los dos HIGH** (fail-open y puerta sin auth). Son los únicos ítems de seguridad abiertos, y el evento es el **20/8**. | Antes del 20/8 |
| **Inspeccionar la primera compra real de 2+**: dos filas con el mismo `external_payment_id`, `price_cents` **unitario** en cada una, un solo mail con 2 QR. Es lo único que confirma que MercadoPago propaga `metadata.qty` de la Preference al Payment — está documentado pero **nunca se probó con un pago real**. | Primera compra múltiple |
| **Borrar `/tmp/.env.prod`** si sigue ahí. Tiene credenciales de producción en texto plano. | Ya |
| Correr el seeder con `--execute` contra una branch de preview si querés recorrer la superficie nueva a mano. | Cuando quieras |

---

## 7. Nada de este programa está en vuelo

Las seis unidades están merged, los cuatro PRs de sostén también, no queda
ninguna rama abierta, el árbol está limpio y `main` está verde. La migración
está aplicada en producción y verificada. El único trabajo pendiente son los
ítems del backlog y de la checklist de arriba, que son decisiones tuyas, no
trabajo a medio hacer.
