-- Precision de la fecha del evento:
--   LONG  = dia, mes y anio
--   SHORT = solo mes y anio (el dia se guarda como 29 para no romper DATE)
CREATE TYPE "EventDateType" AS ENUM ('LONG', 'SHORT');

ALTER TABLE "events"
  ADD COLUMN "date_type" "EventDateType" NOT NULL DEFAULT 'LONG';
