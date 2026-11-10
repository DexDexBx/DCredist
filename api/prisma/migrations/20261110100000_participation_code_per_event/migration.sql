-- CODIGOS HISTORICOS POR EVENTO
--
-- Los codigos historicos deben conservarse tal cual y pueden repetirse en
-- eventos distintos. Dentro de un mismo evento siguen siendo unicos.
-- Los codigos CURRENT siguen siendo unicos globalmente.

-- Verificacion previa: si hay duplicados dentro del mismo evento, la migracion
-- se detiene con un mensaje claro en lugar de dejar la tabla a medias.
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "eventId", "verificationCode"
    FROM "participations"
    GROUP BY "eventId", "verificationCode"
    HAVING COUNT(*) > 1
  ) AS duplicated;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Existen % codigo(s) repetidos dentro del mismo evento. Corrige esos registros antes de aplicar esta migracion.',
      duplicate_count;
  END IF;
END $$;

-- Los codigos actuales no pueden repetirse entre eventos.
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "verificationCode"
    FROM "participations"
    WHERE "origin" = 'CURRENT'
    GROUP BY "verificationCode"
    HAVING COUNT(*) > 1
  ) AS duplicated;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Existen % codigo(s) CURRENT repetidos. Corrige esos registros antes de aplicar esta migracion.',
      duplicate_count;
  END IF;
END $$;

DROP INDEX IF EXISTS "participations_verificationCode_key";

-- Unicidad por evento (aplica a historicos y actuales).
CREATE UNIQUE INDEX "participations_eventId_verificationCode_key"
  ON "participations"("eventId", "verificationCode");

-- Indice para busquedas por codigo sin filtrar por evento.
CREATE INDEX "participations_verificationCode_idx"
  ON "participations"("verificationCode");

-- Los codigos generados por DCredits siguen siendo unicos globalmente.
CREATE UNIQUE INDEX "participations_current_verificationCode_key"
  ON "participations"("verificationCode")
  WHERE "origin" = 'CURRENT';
