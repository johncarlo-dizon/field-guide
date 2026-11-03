CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"model_number" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"attachment_id" uuid,
	"caption" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_blocks" ADD CONSTRAINT "equipment_blocks_part_id_equipment_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."equipment_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_blocks" ADD CONSTRAINT "equipment_blocks_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_parts" ADD CONSTRAINT "equipment_parts_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_author_idx" ON "equipment" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "equipment_category_idx" ON "equipment" USING btree ("category");--> statement-breakpoint
CREATE INDEX "equipment_blocks_part_idx" ON "equipment_blocks" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "equipment_parts_equipment_idx" ON "equipment_parts" USING btree ("equipment_id");