CREATE TYPE "public"."bank_connection_status" AS ENUM('active', 'expired', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."bank_transaction_status" AS ENUM('auto_recorded', 'needs_review', 'recorded', 'ignored');--> statement-breakpoint
ALTER TYPE "public"."payment_source" ADD VALUE 'bank_sync';--> statement-breakpoint
CREATE TABLE "bank_auth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"aspsp_name" text NOT NULL,
	"aspsp_country" text NOT NULL,
	"psu_type" text NOT NULL,
	"valid_until" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"session_id" text,
	"accounts" jsonb
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'enablebanking' NOT NULL,
	"aspsp_name" text NOT NULL,
	"aspsp_country" text NOT NULL,
	"psu_type" text DEFAULT 'business' NOT NULL,
	"session_id" text NOT NULL,
	"account_uid" text NOT NULL,
	"iban" text,
	"account_name" text,
	"valid_until" timestamp NOT NULL,
	"status" "bank_connection_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp,
	"last_sync_error" text,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"bank_entry_ref" text NOT NULL,
	"booking_date" timestamp NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"reference" text,
	"remittance" text,
	"debtor_name" text,
	"status" "bank_transaction_status" NOT NULL,
	"invoice_id" text,
	"match_kind" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	CONSTRAINT "bank_transactions_bank_entry_ref_unique" UNIQUE("bank_entry_ref")
);
--> statement-breakpoint
ALTER TABLE "bank_auth_states" ADD CONSTRAINT "bank_auth_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;