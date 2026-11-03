-- La capacidad de un evento nunca es nula: 0 significa "sin limite".
-- Se normalizan los registros existentes y se fija el valor por defecto.

UPDATE "events" SET "capacity" = 0 WHERE "capacity" IS NULL;

ALTER TABLE "events" ALTER COLUMN "capacity" SET DEFAULT 0;

ALTER TABLE "events" ALTER COLUMN "capacity" SET NOT NULL;
