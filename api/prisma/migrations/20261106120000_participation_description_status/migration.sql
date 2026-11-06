-- Motivo o descripcion del estado de la participacion.
ALTER TABLE "participations"
  ADD COLUMN "description_status" VARCHAR(500) NOT NULL DEFAULT 'valid';

-- Las anulaciones existentes no tienen motivo: se deja una etiqueta legible.
UPDATE "participations"
SET "description_status" = 'Anulación sin motivo registrado'
WHERE "status" = 'CANCELLED';
