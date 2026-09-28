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
--> statement-breakpoint
ALTER TABLE "challenge_days" ADD CONSTRAINT "challenge_days_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;