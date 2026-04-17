CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"series" text,
	"name" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"capacity" integer,
	"status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_status_check" CHECK ("events"."status" IN ('upcoming','live','past','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"person_id" bigint NOT NULL,
	"package_id" bigint NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"participations_used" integer DEFAULT 0 NOT NULL,
	"external_payment_id" text,
	"price_cents" integer,
	"currency" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_status_check" CHECK ("memberships"."status" IN ('active','exhausted','expired','refunded','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"participations_granted" integer NOT NULL,
	"applies_to_event_type" text,
	"applies_to_series" text,
	"price_cents" integer,
	"currency" text,
	"validity_days" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "packages_status_check" CHECK ("packages"."status" IN ('active','archived'))
);
--> statement-breakpoint
CREATE TABLE "participations" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" bigint NOT NULL,
	"event_id" text NOT NULL,
	"buyer_person_id" bigint,
	"role" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"attribution" jsonb,
	"link_slug" text,
	"referred_by_person_id" bigint,
	"referral_note" text,
	"external_payment_id" text,
	"price_cents" integer,
	"currency" text,
	"membership_id" bigint,
	"used_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participations_status_check" CHECK ("participations"."status" IN ('pending','confirmed','waitlist','cancelled','no_show','used'))
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" "citext",
	"name" text NOT NULL,
	"phone" text,
	"instagram" text,
	"language" text DEFAULT 'es' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"first_touch" jsonb,
	"communication_opt_ins" text[] DEFAULT ARRAY['email:transactional','email:marketing']::text[] NOT NULL,
	"opted_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_email_unique" UNIQUE("email"),
	CONSTRAINT "people_language_check" CHECK ("people"."language" IN ('es','en')),
	CONSTRAINT "people_contact_check" CHECK ("people"."email" IS NOT NULL OR "people"."phone" IS NOT NULL OR "people"."instagram" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "person_organizations" (
	"person_id" bigint NOT NULL,
	"organization_id" bigint NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_organizations_person_id_organization_id_pk" PRIMARY KEY("person_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_buyer_person_id_people_id_fk" FOREIGN KEY ("buyer_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_referred_by_person_id_people_id_fk" FOREIGN KEY ("referred_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_organizations" ADD CONSTRAINT "person_organizations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_organizations" ADD CONSTRAINT "person_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "events_series_date_idx" ON "events" USING btree ("series","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status") WHERE "events"."status" IN ('upcoming','live');--> statement-breakpoint
CREATE INDEX "memberships_person_idx" ON "memberships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "memberships_status_idx" ON "memberships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organizations_type_idx" ON "organizations" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "participations_person_event_unique" ON "participations" USING btree ("person_id","event_id");--> statement-breakpoint
CREATE INDEX "participations_event_id_idx" ON "participations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "participations_person_id_idx" ON "participations" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "participations_buyer_idx" ON "participations" USING btree ("buyer_person_id") WHERE "participations"."buyer_person_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "participations_created_at_idx" ON "participations" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "participations_link_slug_idx" ON "participations" USING btree ("link_slug") WHERE "participations"."link_slug" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "participations_status_idx" ON "participations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "participations_external_payment_idx" ON "participations" USING btree ("external_payment_id") WHERE "participations"."external_payment_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "participations_referred_by_idx" ON "participations" USING btree ("referred_by_person_id") WHERE "participations"."referred_by_person_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "participations_unresolved_refs_idx" ON "participations" USING btree ("id") WHERE "participations"."referral_note" IS NOT NULL AND "participations"."referred_by_person_id" IS NULL;--> statement-breakpoint
CREATE INDEX "people_created_at_idx" ON "people" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "people_first_seen_idx" ON "people" USING btree ("first_seen" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "people_tags_gin_idx" ON "people" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "people_opt_ins_gin_idx" ON "people" USING gin ("communication_opt_ins");