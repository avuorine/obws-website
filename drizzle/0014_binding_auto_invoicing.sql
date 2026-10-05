ALTER TABLE "event_registrations" ADD COLUMN "auto_invoice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "supplementary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "seat_release_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_live_unique" ON "event_registrations" USING btree ("event_id","user_id") WHERE "event_registrations"."status" <> 'cancelled';