CREATE TABLE "admin_user_event_scopes" (
	"admin_user_id" bigint NOT NULL,
	"event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_user_event_scopes_admin_user_id_event_id_pk" PRIMARY KEY("admin_user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"scope" text DEFAULT 'scoped' NOT NULL,
	"created_by_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email"),
	CONSTRAINT "admin_users_role_check" CHECK ("admin_users"."role" IN ('owner','editor','viewer')),
	CONSTRAINT "admin_users_scope_check" CHECK ("admin_users"."scope" IN ('all','scoped')),
	CONSTRAINT "admin_users_owner_scope_check" CHECK ("admin_users"."role" <> 'owner' OR "admin_users"."scope" = 'all')
);
--> statement-breakpoint
ALTER TABLE "admin_user_event_scopes" ADD CONSTRAINT "admin_user_event_scopes_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_user_event_scopes" ADD CONSTRAINT "admin_user_event_scopes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_user_event_scopes_event_idx" ON "admin_user_event_scopes" USING btree ("event_id");