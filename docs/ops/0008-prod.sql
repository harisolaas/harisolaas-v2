-- Migración 0008 — columnas nuevas en challenge_days (modelo de contenido del
-- diseño del Desafío: video de intro, título de la meditación, duración,
-- reflexión y video de reflexión). PRODUCCIÓN.
--
-- Requiere 0007 aplicada (docs/ops/0007-prod.sql). Correr como una sola
-- transacción, DESPUÉS de 0007 y JUSTO ANTES de mergear el PR (el código
-- nuevo lee estas columnas en su primer request; el código viejo las ignora,
-- así que aplicarla antes es seguro):
--
--   psql "$PROD_URL" --single-transaction -f docs/ops/0008-prod.sql
--
-- PROD_URL sale de `vercel env pull /tmp/.env.prod --environment=production`,
-- NUNCA de `.env.local`.
--
-- Pre-flight: SELECT max(created_at) FROM drizzle.__drizzle_migrations;
--   → tiene que dar 1790612377883 (0007).
-- Verificación:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'challenge_days' AND column_name IN (
--     'intro_video_url', 'meditation_title', 'duration_label',
--     'reflection', 'reflection_video_url');
--   → 5 filas.
--
-- Re-ejecución: segura. A diferencia de 0007, usa ADD COLUMN IF NOT EXISTS
-- (el SQL generado por drizzle no lo tiene; es la única diferencia) y el
-- ledger tiene guard por hash, así que correrla dos veces no cambia nada.
--
-- Es puramente aditiva: cinco columnas text nullable, sin default. En
-- Postgres eso es un cambio de catálogo (no reescribe la tabla) y no toca
-- filas existentes.

SET lock_timeout = '3s';

ALTER TABLE "challenge_days" ADD COLUMN IF NOT EXISTS "intro_video_url" text;
ALTER TABLE "challenge_days" ADD COLUMN IF NOT EXISTS "meditation_title" text;
ALTER TABLE "challenge_days" ADD COLUMN IF NOT EXISTS "duration_label" text;
ALTER TABLE "challenge_days" ADD COLUMN IF NOT EXISTS "reflection" text;
ALTER TABLE "challenge_days" ADD COLUMN IF NOT EXISTS "reflection_video_url" text;

-- Ledger en la misma transacción que el DDL.
-- hash = shasum -a 256 src/db/migrations/0008_wide_red_ghost.sql
-- created_at = el `when` de 0008 en meta/_journal.json
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
SELECT
  '2c34ea926515b9fa26937042afba108f745b4cf7c8d23b2fbbd20f24b8c56611',
  1790618438154
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle."__drizzle_migrations"
  WHERE hash = '2c34ea926515b9fa26937042afba108f745b4cf7c8d23b2fbbd20f24b8c56611'
);
