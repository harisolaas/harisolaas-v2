CREATE TABLE "link_clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"link_slug" text NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"referer" text,
	"ip_hash" text,
	"is_bot" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"slug" text PRIMARY KEY NOT NULL,
	"destination" text NOT NULL,
	"label" text NOT NULL,
	"channel" text NOT NULL,
	"source" text NOT NULL,
	"medium" text NOT NULL,
	"campaign" text,
	"resource_url" text,
	"note" text,
	"created_date" text NOT NULL,
	"created_by" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_status_check" CHECK ("links"."status" IN ('active','archived','disabled'))
);
--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_link_slug_links_slug_fk" FOREIGN KEY ("link_slug") REFERENCES "public"."links"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_clicks_slug_clicked_idx" ON "link_clicks" USING btree ("link_slug","clicked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "links_channel_idx" ON "links" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "links_campaign_idx" ON "links" USING btree ("campaign") WHERE "links"."campaign" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "links_created_at_idx" ON "links" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "links_status_idx" ON "links" USING btree ("status");--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_link_slug_links_slug_fk" FOREIGN KEY ("link_slug") REFERENCES "public"."links"("slug") ON DELETE set null ON UPDATE no action;