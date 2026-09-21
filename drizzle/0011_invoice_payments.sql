CREATE TYPE "public"."payment_source" AS ENUM('bank_import', 'manual');--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_at" timestamp NOT NULL,
	"reference" text,
	"bank_entry_ref" text,
	"source" "payment_source" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payments_bank_entry_ref_unique" UNIQUE("bank_entry_ref")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
UPDATE "invoices" SET "paid_amount" = "amount" WHERE "status" = 'paid';
--> statement-breakpoint
INSERT INTO "invoice_payments" ("id", "invoice_id", "amount", "paid_at", "source")
SELECT gen_random_uuid()::text, "id", "amount", COALESCE("paid_at", "updated_at"), 'manual'
FROM "invoices" WHERE "status" = 'paid';
