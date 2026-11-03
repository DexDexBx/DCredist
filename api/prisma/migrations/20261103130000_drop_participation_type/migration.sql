-- La participacion ya no distingue tipos (asistente, ponente, etc.).
-- El dato no se usa en el dominio actual: se elimina la columna y su enum.

ALTER TABLE "participations" DROP COLUMN "participationType";

DROP TYPE "ParticipationType";
