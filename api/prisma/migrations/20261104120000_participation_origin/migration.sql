-- Procedencia del registro: actual (codigo generado por DCredits) o historico
-- (conserva el codigo de verificacion que ya tenia la data antigua).
CREATE TYPE "ParticipationOrigin" AS ENUM ('CURRENT', 'LEGACY');

ALTER TABLE "participations"
  ADD COLUMN "origin" "ParticipationOrigin" NOT NULL DEFAULT 'CURRENT';

CREATE INDEX "participations_origin_idx" ON "participations"("origin");
