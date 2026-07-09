CREATE TABLE "wallet_pass_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"device_library_identifier" text NOT NULL,
	"pass_type_identifier" text NOT NULL,
	"serial_number" text NOT NULL,
	"push_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_pass_registrations_device_library_identifier_serial_number_unique" UNIQUE("device_library_identifier","serial_number")
);
--> statement-breakpoint
CREATE TABLE "wallet_passes" (
	"serial_number" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
