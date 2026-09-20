ALTER TABLE "invoices" ADD COLUMN "seat_count" integer;
--> statement-breakpoint
UPDATE "invoices" i
SET "seat_count" = GREATEST(1, ROUND(i."amount" / e."price"))::integer
FROM "event_registrations" r
JOIN "events" e ON e."id" = r."event_id"
WHERE i."event_registration_id" = r."id"
  AND i."type" = 'event_fee'
  AND e."price" IS NOT NULL
  AND e."price" > 0;
