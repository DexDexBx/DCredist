-- Las participaciones que heredaron la fecha sentinela de un evento historico
-- (1999-09-29) quedan alineadas con la fecha real del evento cuando este ya la
-- tiene. No toca fechas personalizadas distintas de la sentinela.
UPDATE "participations" AS p
SET "participationDate" = (e."startDate" + interval '12 hours')
FROM "events" AS e
WHERE p."eventId" = e."id"
  AND p."participationDate" >= TIMESTAMP '1999-09-29 00:00:00'
  AND p."participationDate" <  TIMESTAMP '1999-09-30 00:00:00'
  AND e."startDate" <> DATE '1999-09-29';
