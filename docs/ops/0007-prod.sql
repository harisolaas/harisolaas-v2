-- Migración 0007 — tabla challenge_days (Desafío 15 días). PRODUCCIÓN.
--
-- Correr como una sola transacción, JUSTO ANTES de mergear el PR (Vercel
-- deploya apenas mergea y la página nueva consulta la tabla en su primer
-- request; el código viejo la ignora, así que aplicarla antes es seguro):
--
--   psql "$PROD_URL" --single-transaction -f docs/ops/0007-prod.sql
--
-- PROD_URL sale de `vercel env pull /tmp/.env.prod --environment=production`,
-- NUNCA de `.env.local`.
--
-- Pre-flight: SELECT max(created_at) FROM drizzle.__drizzle_migrations;
--   → tiene que dar 1786380427385 (0006).
-- Verificación: SELECT to_regclass('public.challenge_days');
--
-- Es puramente aditiva: CREATE TABLE + FK hacia events. No toca filas
-- existentes. La fila de events `desafio-15-dias-2026` NO se inserta acá: la
-- crea `ensureDesafioEvent()` en el primer request al panel o a la inscripción.

SET lock_timeout = '3s';

CREATE TABLE "challenge_days" (
	"event_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"title" text,
	"body" text,
	"media_url" text,
	"published" boolean DEFAULT false NOT NULL,
	"updated_by_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_days_event_id_day_number_pk" PRIMARY KEY("event_id","day_number"),
	CONSTRAINT "challenge_days_day_number_check" CHECK ("challenge_days"."day_number" >= 1)
);

ALTER TABLE "challenge_days" ADD CONSTRAINT "challenge_days_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;

-- Ledger en la misma transacción que el DDL. Idempotente por hash.
-- hash = shasum -a 256 src/db/migrations/0007_perpetual_giant_man.sql
-- created_at = el `when` de 0007 en meta/_journal.json
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
SELECT
  '1d63082a22e26ce3c16540aa9a8c28c6cab00ead7bb2c4ce6f8dc3e8892a5a8a',
  1790612377883
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle."__drizzle_migrations"
  WHERE hash = '1d63082a22e26ce3c16540aa9a8c28c6cab00ead7bb2c4ce6f8dc3e8892a5a8a'
);
