-- Rollback de la migración 0006. PRODUCCIÓN.
--
--   psql "$PROD_URL" --single-transaction -f docs/ops/0006-prod-rollback.sql
--
-- ⚠️ SÓLO ES VÁLIDO MIENTRAS NO EXISTA NINGUNA FILA `role = 'companion'`.
-- Volver al índice único sin condición falla si ya hay una persona con más de
-- una entrada para el mismo evento — que es exactamente lo que la feature
-- crea. Verificar ANTES:
--
--   SELECT COUNT(*) FROM participations WHERE role = 'companion';
--
-- Si eso da > 0, esta puerta ya está cerrada: el rollback correcto es revertir
-- el CÓDIGO que emite companions (U3/U4), no el índice. El índice parcial es
-- inofensivo para el código viejo.
--
-- Y no revertir el código de U1 mientras existan companions: sin su ORDER BY,
-- la sonda de fila existente de `recordParticipation` devuelve una fila
-- arbitraria de la persona, y ese id es el anclaje de Redis de todo lo demás.

SET lock_timeout = '3s';

DROP INDEX "participations_person_event_unique";

CREATE UNIQUE INDEX "participations_person_event_unique"
  ON "participations" USING btree ("person_id", "event_id");
