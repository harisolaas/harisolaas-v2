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
