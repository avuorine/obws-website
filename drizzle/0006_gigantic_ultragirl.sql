CREATE TABLE "association_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '',
	"business_id" text DEFAULT '',
	"iban" text DEFAULT '',
	"bic" text DEFAULT '',
	"email" text DEFAULT '',
	"phone" text DEFAULT '',
	"next_invoice_number" integer DEFAULT 1 NOT NULL
);
