ALTER TABLE "user" ADD COLUMN "member_number" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "resigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_member_number_unique" UNIQUE("member_number");