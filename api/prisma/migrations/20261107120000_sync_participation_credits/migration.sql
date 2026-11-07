-- Los creditos del evento son la fuente de verdad. Sincroniza las
-- participaciones existentes que quedaron con el valor anterior tras editar
-- los creditos del evento.
UPDATE "participations" AS p
SET "credits" = e."credits"
FROM "events" AS e
WHERE p."eventId" = e."id"
  AND p."credits" <> e."credits";
