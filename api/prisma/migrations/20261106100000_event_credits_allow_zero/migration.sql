-- Un evento puede otorgar 0 creditos. Se relaja la restriccion anterior
-- (>= 1) manteniendo el maximo de 21 y el valor por defecto 1.
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_credits_range_check";

ALTER TABLE "events" ADD CONSTRAINT "events_credits_range_check"
  CHECK ("credits" >= 0 AND "credits" <= 21);
