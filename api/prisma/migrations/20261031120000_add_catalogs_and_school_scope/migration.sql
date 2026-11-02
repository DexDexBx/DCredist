-- CATALOGOS NORMALIZADOS Y ALCANCE POR ESCUELA.
--
-- Las tres tablas nuevas se crean primero, tal como se definio. Despues se
-- agregan las FKs obligatorias en users, students y events.
--
-- El modelo nuevo no admite valores huerfanos ni texto libre en estas
-- relaciones. Como se confirmo que no hay backfill, se vacian las tablas que
-- dependen de los catalogos; el seed de demostracion recrea el administrador y
-- la escuela `general`.

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "professional_schools" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professional_schools_name_key" ON "professional_schools"("name");

-- CreateIndex
CREATE INDEX "professional_schools_status_idx" ON "professional_schools"("status");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");

-- CreateIndex
CREATE INDEX "locations_status_idx" ON "locations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organizers_name_key" ON "organizers"("name");

-- CreateIndex
CREATE INDEX "organizers_status_idx" ON "organizers"("status");

-- Limpieza. El nuevo modelo exige FKs obligatorias y no hay backfill: se
-- vacian los registros que dependian de los textos viejos. `modules` se
-- conserva; el seed vuelve a crear el administrador y sus permisos.
TRUNCATE TABLE "user_module_permissions", "participations", "students", "events", "users" CASCADE;

-- DropIndex
DROP INDEX "students_professionalSchool_idx";

-- DropIndex
DROP INDEX "students_headquarters_idx";

-- DropIndex
DROP INDEX "users_professionalSchool_idx";

-- AlterTable
ALTER TABLE "students"
    DROP COLUMN "professionalSchool",
    DROP COLUMN "headquarters",
    ADD COLUMN "professionalSchoolId" INTEGER NOT NULL,
    ADD COLUMN "locationId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "events"
    DROP COLUMN "organizer",
    ADD COLUMN "organizerId" INTEGER NOT NULL,
    ADD COLUMN "professionalSchoolId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "users"
    DROP COLUMN "professionalSchool",
    ADD COLUMN "professionalSchoolId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "students_professionalSchoolId_idx" ON "students"("professionalSchoolId");

-- CreateIndex
CREATE INDEX "students_locationId_idx" ON "students"("locationId");

-- CreateIndex
CREATE INDEX "events_organizerId_idx" ON "events"("organizerId");

-- CreateIndex
CREATE INDEX "events_professionalSchoolId_idx" ON "events"("professionalSchoolId");

-- CreateIndex
CREATE INDEX "users_professionalSchoolId_idx" ON "users"("professionalSchoolId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
