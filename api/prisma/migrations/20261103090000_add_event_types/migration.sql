-- TIPOS DE EVENTO ACADEMICO.
--
-- `events.category` (texto libre) se reemplaza por una relacion obligatoria con
-- la tabla `event_types`. El nombre se guarda en ingles; la interfaz muestra la
-- traduccion al espanol.
--
-- Los eventos existentes se conservan: se mapea su categoria anterior al tipo
-- equivalente y, si no coincide ninguno, quedan como "Congress".

-- CreateTable
CREATE TABLE "event_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_types_name_key" ON "event_types"("name");

-- CreateIndex
CREATE INDEX "event_types_status_idx" ON "event_types"("status");

-- Catalogo inicial de tipos de evento (nombres en ingles).
INSERT INTO "event_types" ("name", "updatedAt") VALUES
    ('Congress', CURRENT_TIMESTAMP),
    ('Seminar', CURRENT_TIMESTAMP),
    ('Workshop', CURRENT_TIMESTAMP),
    ('Course', CURRENT_TIMESTAMP),
    ('Forum', CURRENT_TIMESTAMP),
    ('Conference', CURRENT_TIMESTAMP),
    ('Webinar', CURRENT_TIMESTAMP),
    ('Exhibition', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- AlterTable: nueva FK nullable para poder mapear los eventos existentes.
ALTER TABLE "events" ADD COLUMN "eventTypeId" INTEGER;

UPDATE "events" SET "eventTypeId" = (
    SELECT "id" FROM "event_types"
    WHERE "name" = CASE lower(trim("category"))
        WHEN 'congreso' THEN 'Congress'
        WHEN 'seminario' THEN 'Seminar'
        WHEN 'taller' THEN 'Workshop'
        WHEN 'curso' THEN 'Course'
        WHEN 'foro' THEN 'Forum'
        WHEN 'conferencia' THEN 'Conference'
        WHEN 'webinar' THEN 'Webinar'
        WHEN 'muestra' THEN 'Exhibition'
        ELSE 'Congress'
    END
);

ALTER TABLE "events" ALTER COLUMN "eventTypeId" SET NOT NULL;

-- AlterTable: se elimina el texto libre.
ALTER TABLE "events" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "events_eventTypeId_idx" ON "events"("eventTypeId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
