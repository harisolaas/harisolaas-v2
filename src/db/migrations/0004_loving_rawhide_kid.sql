CREATE TABLE "whatsapp_messages" (
	"message_id" text PRIMARY KEY NOT NULL,
	"person_id" bigint,
	"template_name" text NOT NULL,
	"language_code" text NOT NULL,
	"to_phone" text NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error_code" text,
	"error_message" text,
	"campaign" text,
	"last_status_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_status_check" CHECK ("whatsapp_messages"."status" IN ('sent','delivered','read','failed','deleted'))
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"name" text PRIMARY KEY NOT NULL,
	"meta_template_id" text,
	"category" text NOT NULL,
	"language" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"quality_score" text,
	"rejection_reason" text,
	"components" jsonb NOT NULL,
	"variable_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"submitted_at" timestamp with time zone,
	"last_status_at" timestamp with time zone,
	"local_definition_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_templates_status_check" CHECK ("whatsapp_templates"."status" IN ('draft','pending','approved','rejected','paused','disabled','in_appeal','flagged','locked','pending_deletion')),
	CONSTRAINT "whatsapp_templates_category_check" CHECK ("whatsapp_templates"."category" IN ('utility','marketing','authentication'))
);
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_messages_person_idx" ON "whatsapp_messages" USING btree ("person_id") WHERE "whatsapp_messages"."person_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_messages_template_idx" ON "whatsapp_messages" USING btree ("template_name");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_status_idx" ON "whatsapp_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_campaign_idx" ON "whatsapp_messages" USING btree ("campaign") WHERE "whatsapp_messages"."campaign" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_messages_created_at_idx" ON "whatsapp_messages" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "whatsapp_templates_status_idx" ON "whatsapp_templates" USING btree ("status");