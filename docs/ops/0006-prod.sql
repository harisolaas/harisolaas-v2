-- Migración 0006 — índice único parcial en participations. PRODUCCIÓN.
--
-- Correr SIEMPRE como una sola transacción:
--
--   psql "$PROD_URL" --single-transaction -f docs/ops/0006-prod.sql
--
-- NO splitear por `--> statement-breakpoint` ni mandarlo por el driver HTTP de
-- neon() sentencia por sentencia. Ese driver autocommitea cada request, y entre
-- el DROP y el CREATE la tabla queda SIN ninguna unicidad sobre
-- (person_id, event_id). En esa ventana `recordParticipation` —que es
-- SELECT-después-INSERT bajo READ COMMITTED— deja entrar una duplicada, y
-- entonces el CREATE UNIQUE INDEX falla: producción se queda sin el índice
-- viejo, sin el nuevo, y con la migración a medio aplicar sobre un sistema de
-- pagos vivo.
--
-- Es una RELAJACIÓN, no un endurecimiento: el índice viejo es único sin
-- condición sobre las mismas columnas, el nuevo lo es sobre un subconjunto
-- estricto. Por eso el CREATE no puede fallar por datos preexistentes — sólo
-- podría fallar por una duplicada nacida en la ventana que esta transacción
-- elimina.

-- Si el lock está disputado, abortar en vez de encolar tráfico detrás nuestro.
-- DROP INDEX toma ACCESS EXCLUSIVE, que bloquea LECTURAS además de escrituras
-- —incluido el conteo de capacidad dentro de recordParticipation— y espera
-- detrás de cualquier transacción abierta sobre la tabla.
SET lock_timeout = '3s';

DROP INDEX "participations_person_event_unique";

CREATE UNIQUE INDEX "participations_person_event_unique"
  ON "participations" USING btree ("person_id", "event_id")
  WHERE "participations"."role" <> 'companion';

-- El ledger va en LA MISMA transacción que el DDL, a propósito: si quedaran
-- separados se puede aplicar el índice y no registrarlo, y la próxima
-- migración vuelve a intentar 0006 (el DROP fallaría y quedaría a medias).
--
-- Idempotente por hash: correrlo dos veces no duplica la fila.
-- hash = shasum -a 256 src/db/migrations/0006_magenta_ogun.sql
-- created_at = el `when` de 0006 en meta/_journal.json
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
SELECT
  'e42511b497f7e93cb182294818ca38d140e78e2e27c88548f03b9d0c6483c1fd',
  1786380427385
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle."__drizzle_migrations"
  WHERE hash = 'e42511b497f7e93cb182294818ca38d140e78e2e27c88548f03b9d0c6483c1fd'
);
