-- Los creditos de un evento siempre estan entre 1 y 21.
-- Se normalizan los registros existentes antes de fijar la restriccion.

UPDATE "events" SET "credits" = 1 WHERE "credits" < 1 OR "credits" IS NULL;
UPDATE "events" SET "credits" = 21 WHERE "credits" > 21;

ALTER TABLE "events" ALTER COLUMN "credits" SET DEFAULT 1;

ALTER TABLE "events" ADD CONSTRAINT "events_credits_range_check"
  CHECK ("credits" >= 1 AND "credits" <= 21);
