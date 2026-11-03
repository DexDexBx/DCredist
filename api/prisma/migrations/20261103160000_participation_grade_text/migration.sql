-- La nota pasa de numero nulo a texto legible.
--   NULL -> 'sin nota'
--   numeros -> su representacion textual (ej. 16, 17.5)
-- Longitud maxima: 10 caracteres. Nunca queda NULL.

ALTER TABLE "participations"
  ALTER COLUMN "grade" TYPE VARCHAR(10)
  USING (CASE WHEN "grade" IS NULL THEN 'sin nota' ELSE "grade"::text END);

ALTER TABLE "participations" ALTER COLUMN "grade" SET DEFAULT 'sin nota';

ALTER TABLE "participations" ALTER COLUMN "grade" SET NOT NULL;
