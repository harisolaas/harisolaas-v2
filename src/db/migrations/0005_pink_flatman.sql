CREATE TABLE "email_verifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"token" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "email_verifications_token_unique" UNIQUE("token"),
	CONSTRAINT "email_verifications_status_check" CHECK ("email_verifications"."status" IN ('pending', 'verified', 'consumed', 'superseded')),
	CONSTRAINT "email_verifications_email_normalized_check" CHECK ("email_verifications"."email" = lower(trim("email_verifications"."email")))
);
--> statement-breakpoint
CREATE INDEX "email_verifications_email_idx" ON "email_verifications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_verifications_pending_email_uniq" ON "email_verifications" USING btree ("email") WHERE "email_verifications"."status" = 'pending';