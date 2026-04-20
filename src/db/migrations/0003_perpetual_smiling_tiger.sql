ALTER TABLE "links" ADD COLUMN "bypass_capacity" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "referred_by_person_id" bigint;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_referred_by_person_id_people_id_fk" FOREIGN KEY ("referred_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;