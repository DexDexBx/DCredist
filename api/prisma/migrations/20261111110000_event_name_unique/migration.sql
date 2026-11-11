-- El nombre del evento es unico en todo DCredits: aplica a registros
-- CURRENT y LEGACY. Se compara sin distinguir mayusculas y sin espacios
-- sobrantes (espacios al inicio/fin o repetidos dentro del nombre).
--
-- Si ya existen eventos con el mismo nombre, la migracion falla con el listado
-- de duplicados para que se resuelvan antes de volver a ejecutarla.

DO $$
DECLARE
  duplicates text;
BEGIN
  SELECT string_agg(format('%s (%s veces)', duplicated_name, total), '; ')
  INTO duplicates
  FROM (
    SELECT MIN(name) AS duplicated_name, COUNT(*) AS total
    FROM "events"
    GROUP BY LOWER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g'))
    HAVING COUNT(*) > 1
  ) AS grouped;

  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION
      'No se puede crear la restriccion de nombre unico de eventos. Resuelve estos duplicados: %',
      duplicates;
  END IF;
END $$;

CREATE UNIQUE INDEX "events_name_unique_key"
  ON "events" (LOWER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g')));
