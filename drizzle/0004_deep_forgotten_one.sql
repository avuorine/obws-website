ALTER TABLE "events" ADD COLUMN "cancellation_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cancellation_deadline" timestamp;