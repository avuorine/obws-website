CREATE TABLE "member_discounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name_locales" jsonb NOT NULL,
	"offer_locales" jsonb NOT NULL,
	"details_locales" jsonb,
	"address" text,
	"url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "member_discounts" ("id", "name_locales", "offer_locales", "details_locales", "address", "url", "sort_order")
VALUES (
	gen_random_uuid()::text,
	'{"sv": "Kyrö Distillery – besökscenter", "fi": "Kyrö Distillery – vierailukeskus", "en": "Kyrö Distillery – Visitor Center"}'::jsonb,
	'{"sv": "10 % rabatt på whisky och cocktails", "fi": "10 % alennus viskeistä ja cocktaileista", "en": "10 % off whiskies and cocktails"}'::jsonb,
	'{"sv": "Visa ditt digitala medlemskort.", "fi": "Näytä digitaalinen jäsenkorttisi.", "en": "Show your digital membership card."}'::jsonb,
	'Oltermannintie 6, 61500 Isokyrö',
	'https://visit.kyrodistillery.com',
	0
);
