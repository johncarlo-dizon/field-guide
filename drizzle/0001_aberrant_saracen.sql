CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_path" text NOT NULL,
	"thumb_path" text,
	"ocr_text" text DEFAULT '' NOT NULL,
	"width" integer,
	"height" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"error_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"attachment_id" uuid,
	"caption" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"error_text" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_blocks" ADD CONSTRAINT "error_blocks_error_id_errors_id_fk" FOREIGN KEY ("error_id") REFERENCES "public"."errors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_blocks" ADD CONSTRAINT "error_blocks_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "errors" ADD CONSTRAINT "errors_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_blocks_error_idx" ON "error_blocks" USING btree ("error_id");--> statement-breakpoint
CREATE INDEX "errors_author_idx" ON "errors" USING btree ("author_id");