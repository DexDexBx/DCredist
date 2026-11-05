-- Modalidad sin valor conocido (registros historicos).
ALTER TYPE "EventModality" ADD VALUE IF NOT EXISTS 'UNSPECIFIED';

-- Procedencia del evento: actual (CURRENT) o historico (LEGACY).
CREATE TYPE "EventOrigin" AS ENUM ('CURRENT', 'LEGACY');

ALTER TABLE "events"
  ADD COLUMN "origin" "EventOrigin" NOT NULL DEFAULT 'CURRENT';

CREATE INDEX "events_origin_idx" ON "events"("origin");

-- Campos opcionales: normalizamos los vacios a su valor por defecto legible.
UPDATE "events" SET "description" = 'Sin descripción' WHERE "description" = '' OR "description" IS NULL;
ALTER TABLE "events" ALTER COLUMN "description" SET DEFAULT 'Sin descripción';

UPDATE "events" SET "location" = 'Sin ubicación' WHERE "location" = '' OR "location" IS NULL;
ALTER TABLE "events" ALTER COLUMN "location" SET DEFAULT 'Sin ubicación';

-- Tipo de evento "No especificado": es el respaldo cuando un registro historico
-- no trae tipo academico.
INSERT INTO "event_types" ("name", "status", "updatedAt")
VALUES ('Unspecified', 'ACTIVE', CURRENT_TIMESTAMP);
