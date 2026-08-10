# Handback — BROTE: tarjeta OG, SEO y links a colaboradores

Programa ejecutado con el skill `implementation-programme`.
Spec: [`tasks/brote-og-seo-colaboradores.md`](brote-og-seo-colaboradores.md) ·
Memoria: [`tasks/PROGRESS-brote-og-seo.md`](PROGRESS-brote-og-seo.md) ·
Lecciones: [`tasks/lessons.md`](lessons.md)

**Cinco unidades, cinco PRs, ninguno mergeado.** El sitio está live y
`CLAUDE.md` pide un "ship"/"mergealo" explícito.

---

## 1. Qué shippeó

| Unidad | PR | Qué cambia para una persona |
|---|---|---|
| U1 | [#70](https://github.com/harisolaas/harisolaas-v2/pull/70) | Compartir la landing por WhatsApp/Instagram ahora muestra la tarjeta del **20 de agosto**, no la del 28 de marzo. Y `/es/brote` deja de decirle a Google que su URL canónica es el home |
| U3 | [#71](https://github.com/harisolaas/harisolaas-v2/pull/71) | Cada colaborador tiene link: el **nombre al sitio propio**, el **@handle a Instagram**. El link de Gian estaba muerto. Pulso aparece por primera vez en la landing |
| U2 | [#74](https://github.com/harisolaas/harisolaas-v2/pull/74) | Google puede mostrar fecha, lugar y precio en el resultado de búsqueda |
| U4 | [#73](https://github.com/harisolaas/harisolaas-v2/pull/73) | El mail del día del evento nombra y linkea a quién toca, **y deja de contradecir la landing en los horarios**; los tres pies de mail linkean a El Arte de Vivir |
| U5 | [#72](https://github.com/harisolaas/harisolaas-v2/pull/72) | `CLAUDE.md` describe el código que existe, no el de la edición 1 |

**Orden de merge:** `#70 → #71 → #74 → #73 → #72`.
Replayado por el verificador: los cinco mergean sin conflicto, y sobre el árbol
completo `tsc` queda limpio, `eslint` da **0 errores / 23 warnings — idénticos
al baseline de `origin/main`**, `next build` compila y la suite pasa de **185 a
249 tests en verde**.

`#72` **tiene que ir último**: documenta `BROTE_OG_IMAGE` (U1) y los helpers del
registro (U3). Mergeado antes, `CLAUDE.md` describe cosas que no existen — que
es exactamente el modo de falla que ese PR arregla, con el signo cambiado.

### Dos cosas que no pediste y conviene que sepas

- **El link de Gian estaba roto.** El diccionario tenía `instagram.com/gianbejarano`
  y el registro `@_gianbejarano`. No parché la URL: saqué la causa. La identidad
  estaba duplicada en el diccionario, que es justo lo que `types.ts` ya prohibía.
  Ahora hay un solo dueño y un test recorre los diccionarios exigiendo que cada
  slug resuelva, así que esta clase de bug no puede volver a entrar.
- **La landing se estaba autosuprimiendo en búsqueda.** Ninguna página de BROTE
  declaraba su canonical, así que todas heredaban `/${locale}` del layout. Con
  el evento a diez días, era la landing compitiendo contra el sitio personal y
  perdiendo. No estaba en el pedido original; era lo más caro de los tres.

### Un cambio de copy que quizás quieras revisar

`"José Dezanzo, solo y con guitarra"` → `"Toca José Dezanzo, guitarra y voz, sin
nada en el medio"`. Partir la oración para poder linkear el nombre lo requería;
de paso evita el "solo" con género que `CLAUDE.md` pide esquivar, y coincide con
cómo ya lo describe su propia página de invitación. Se revierte en una línea.

---

## 2. Veredicto de cierre

**SAFE TO STOP.** Las cinco afirmaciones verificadas de forma independiente
contra el código, con mutaciones y leyendo el HTML, el sitemap, el robots y el
JSON-LD emitidos por un build real.

| Unidad | Veredicto |
|---|---|
| U1 | **HOLDS** — canonical, hreflang, sitemap en `www`, `og-brote-v2.png` resuelto absoluto, y la landing **sin** meta robots. Diff de robots/canonical sobre las 26 páginas prerenderizadas: solo gate ×2, failure ×2 y flyer ganaron `noindex`; nada legítimo quedó cerrado |
| U3 | **HOLDS** — los 8 links salientes resuelven, `instagram.com/gianbejarano` no aparece en ningún lado, y ninguna copy previa se perdió (verificado fragmento por fragmento sobre el HTML buildeado) |
| U2 | **HOLDS** — `Event` con las dos ofertas, timestamps `-03:00`, venue derivado de `broteConfig`, performers `Person` con `sameAs` |
| U4 | **HOLDS** — José atado a la fila de las 19:45, Gian a la de las 21:30, y los tres pies linkeados |
| U5 | **HOLDS** — cada afirmación del doc chequeada contra el código |

**UNVERIFIABLE desde acá** (honesto, no redondeado a HOLDS):

- **Que los perfiles de Instagram estén vivos.** Instagram devuelve 200 también
  para handles inexistentes — el verificador lo comprobó usando el `gianbejarano`
  viejo como control. Lo que sí está verificado es que hay una sola fuente por
  colaborador y que coincide con el registro que ya estaba en `main`. Los tres
  sitios web (`matelabco.com`, `unarbol.org`, `artofliving.org/ar-es/`) sí
  devuelven 200 reales.
- **Cómo se ve la tarjeta al compartir en producción.** Requiere el deploy y el
  Sharing Debugger. Está en tu checklist.

---

## 3. La aplicación está sana

| Chequeo | Evidencia |
|---|---|
| Árbol limpio, sin stash | `git status --porcelain` vacío |
| Ninguna rama sin PR ni PR sin cerrar | 5 ramas, 5 PRs (#70–#74), los cinco `MERGEABLE` |
| `main` intacto | Ningún merge; `origin/main` sigue en `b6b6a31` |
| CI verde | #70, #71, #72 verdes en `Build + lint + test`. #73 y #74 no lo corren por ser stackeados (`pull_request: branches: [main]`) — compensado corriendo sus suites y el build del árbol mergeado localmente |
| Ninguna unidad a medias | Todo helper tiene call site; verificado uno por uno |
| Sin andamios | Ni `.only` / `.skip` / `.todo` en `src` en ninguna rama; sin archivos temporales |
| Sin regresión | `validate/route.ts`, `brote-ticket-email.ts`, `confirm-contact/route.ts` y `brote-contact.ts` **byte-idénticos** entre `origin/main` y el árbol mergeado. El gate renderiza igual que antes (mismo árbol de tags), solo suma el meta `robots` |

---

## 4. Checklist tuyo

| Acción | Cuándo |
|---|---|
| **Decidir los merges** (orden arriba) | Cuando quieras |
| **Re-escanear `/es/brote` en el Facebook Sharing Debugger** — fuerza el refetch de la tarjeta en WhatsApp y Facebook | Apenas #70 esté en producción |
| **Pasar `/es/brote` por el Rich Results Test de Google** | Apenas #74 esté en producción |
| ~~Confirmarme los horarios del line-up~~ — **resuelto**: el mail deriva sus horarios de la landing (20:00 y 21:15). Si el orden real es otro, se cambia en `es.ts` y se mueven las dos superficies juntas | — |
| **Decidir sobre el gate** (ver abajo) | Antes de que abran las puertas el 20 |

---

## 5. Backlog

Todo lo de abajo es **preexistente**. Nada lo introdujo este programa, y no toqué
nada de esto a propósito: arreglar lo que uno encuentra de paso es cómo un
programa de dos semanas se vuelve permanente. Verificado byte a byte que los tres
primeros son idénticos en `origin/main`.

### De la auditoría zero-context del midpoint

| Item | Severidad | Tamaño | Disparador |
|---|---|---|---|
| **El QR de cada entrada es un link de un toque para quemarla.** `brote-ticket-email.ts:53` codifica la URL del gate; `/api/brote/validate` no tiene ninguna autenticación; la página del gate muestra un botón "Marcar como usado". Cualquiera que fotografíe un QR en la fila — o quien escanee el suyo por curiosidad — puede anular esa entrada. `check` además devuelve el nombre del comprador para cualquier ID | **ALTA** | M | **Antes del 20/8** |
| **`/api/brote/confirm-contact` puede sobrescribir `people.phone` de terceros.** Elige la fila por el email que manda el atacante y re-apunta la participación; el token `ct` nunca se marca usado. WhatsApp es el canal del día del evento | **ALTA** | M | Antes del envío por WhatsApp |
| **El 35% de colaborador es un string adivinable y sin tope.** `{"invite":"pulso"}` paga 21.450. Seis palabras comunes, sin prueba de referencia ni vencimiento. Reemplazó al sistema de códigos de un solo uso que se retiró | MED-ALTA | M | Antes del próximo push de colaboradores |
| El guard del webhook es negativo: un pago de MP **sin metadata** emite una entrada real. `transaction_amount` nunca se compara contra un precio esperado | MED | S | Próximo cambio del webhook |
| Sin `MP_WEBHOOK_SECRET`, la verificación de firma devuelve `true` (falla abierta); `ts` sin chequeo de frescura; comparación no constante en tiempo | MED | S | Próximo cambio del webhook |
| El token `ct` está redactado para PostHog pero viaja sin redactar a `<Analytics />` | BAJA-MED | S | Junto con el fix de confirm-contact |
| `Bearer ${undefined}` autentica las rutas de admin si falta la env var | BAJA | S | Próximo cambio de admin |
| Rate limiting es un `Map` por instancia; `validate` no tiene ninguno | BAJA | M | Si aparece abuso |

### Encontrado en vuelo

| Item | Severidad | Tamaño | Disparador |
|---|---|---|---|
| `organizer.url` falta en el `Event` (corte de U2) | BAJA | S | Cuando #70 y #71 estén en `main` |
| `broteInvitacion.footer.right` ("Con Un Árbol") sin linkear | BAJA | S | Próxima pasada de copy en las invitaciones |
| Helper compartido de `generateMetadata` — cinco bloques a mano que ya divergieron | MED | M | Próximo bug de metadata |
| `PlantLanding` y el bloque `plant` del diccionario existen sin ruta que los monte | MED | M | Antes de promocionar la plantación de abril |
| El redirect `/brote-unarbol` hardcodea `/es` para visitantes en inglés | BAJA | S | Si se reparte un link de partner en inglés |
| OG images por colaborador para las cinco páginas de invitación | BAJA | M | Si reportan poco CTR al compartir |
| `og-image.jpg` y `og-sinergia.png` sin `alt` | BAJA | S | Próxima pasada de metadata |

---

## 6. Lecciones que quedaron en el repo

En [`tasks/lessons.md`](lessons.md), porque no son de este programa sino de este
código: que `generateMetadata` devuelve el objeto crudo y `metadataBase` se
resuelve después (así que la aserción obvia no mata la mutación que parece
matar); que un `openGraph` hijo reemplaza al padre; que `Disallow` y `noindex`
se anulan entre sí; que `vitest.config.ts` no levanta `.test.tsx`; que
`next/font/google` es un stub de 0 bytes y el mock va en el archivo de test; que
un preview de Vercel puede fallar por un 404 de Google Fonts; y —la que más
costó— **testear el sink y no solo el builder**: dos veces en este programa se
pudo borrar el efecto entero de una unidad con la suite en verde.

---

## 7. Nada de este programa está en vuelo

La cola está vacía, los cinco PRs están abiertos, verdes y con sus dos rondas de
revisión atendidas, todo lazo abierto tiene disposición terminal, y el árbol de
trabajo está limpio. Lo único pendiente es tu decisión de merge y los cuatro
puntos del checklist.
