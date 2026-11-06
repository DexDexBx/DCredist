-- LINEA BASE DE DCREDITS
--
-- Consolida en una sola migracion el esquema final de la base de datos.
-- Se creo antes del primer despliegue, cuando el historial incremental todavia
-- no era necesario en produccion. A partir de aqui, cada cambio nuevo debe
-- agregarse como una migracion incremental (no se reescribe esta linea base).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SINGLE_DAY', 'MULTI_DAY');

-- CreateEnum
CREATE TYPE "EventModality" AS ENUM ('PRESENTIAL', 'VIRTUAL', 'HYBRID', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventOrigin" AS ENUM ('CURRENT', 'LEGACY');

-- CreateEnum
CREATE TYPE "EventDateType" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('VALID', 'CANCELLED', 'PENDING');

-- CreateEnum
CREATE TYPE "ParticipationOrigin" AS ENUM ('CURRENT', 'LEGACY');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COORDINATOR', 'ORGANIZER', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('NONE', 'VIEW', 'MANAGE');

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

-- CreateTable
CREATE TABLE "event_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "universityCode" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "professionalSchoolId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Sin descripción',
    "duration_type" "EventType" NOT NULL DEFAULT 'SINGLE_DAY',
    "eventTypeId" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "date_type" "EventDateType" NOT NULL DEFAULT 'LONG',
    "modality" "EventModality" NOT NULL DEFAULT 'PRESENTIAL',
    "location" TEXT NOT NULL DEFAULT 'Sin ubicación',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "origin" "EventOrigin" NOT NULL DEFAULT 'CURRENT',
    "organizerId" INTEGER NOT NULL,
    "professionalSchoolId" INTEGER NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "userCreate" TEXT NOT NULL DEFAULT '',
    "userUpdate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "participationDate" TIMESTAMP(3) NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationCode" TEXT NOT NULL,
    "origin" "ParticipationOrigin" NOT NULL DEFAULT 'CURRENT',
    "grade" VARCHAR(10) NOT NULL DEFAULT 'sin nota',
    "status" "ParticipationStatus" NOT NULL DEFAULT 'VALID',
    "userCreate" TEXT NOT NULL DEFAULT 'Usuario 1',
    "userUpdate" TEXT NOT NULL DEFAULT 'Usuario 1',
    "description_status" VARCHAR(500) NOT NULL DEFAULT 'valid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "professionalSchoolId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_module_permissions" (
    "userId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "permission" "PermissionLevel" NOT NULL,

    CONSTRAINT "user_module_permissions_pkey" PRIMARY KEY ("userId","moduleId")
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

-- CreateIndex
CREATE UNIQUE INDEX "event_types_name_key" ON "event_types"("name");

-- CreateIndex
CREATE INDEX "event_types_status_idx" ON "event_types"("status");

-- CreateIndex
CREATE UNIQUE INDEX "students_universityCode_key" ON "students"("universityCode");

-- CreateIndex
CREATE INDEX "students_professionalSchoolId_idx" ON "students"("professionalSchoolId");

-- CreateIndex
CREATE INDEX "students_locationId_idx" ON "students"("locationId");

-- CreateIndex
CREATE INDEX "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE UNIQUE INDEX "events_code_key" ON "events"("code");

-- CreateIndex
CREATE INDEX "events_startDate_idx" ON "events"("startDate");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_origin_idx" ON "events"("origin");

-- CreateIndex
CREATE INDEX "events_organizerId_idx" ON "events"("organizerId");

-- CreateIndex
CREATE INDEX "events_professionalSchoolId_idx" ON "events"("professionalSchoolId");

-- CreateIndex
CREATE INDEX "events_eventTypeId_idx" ON "events"("eventTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "participations_verificationCode_key" ON "participations"("verificationCode");

-- CreateIndex
CREATE INDEX "participations_studentId_idx" ON "participations"("studentId");

-- CreateIndex
CREATE INDEX "participations_status_idx" ON "participations"("status");

-- CreateIndex
CREATE INDEX "participations_origin_idx" ON "participations"("origin");

-- CreateIndex
CREATE UNIQUE INDEX "participations_eventId_studentId_key" ON "participations"("eventId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_professionalSchoolId_idx" ON "users"("professionalSchoolId");

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE INDEX "user_module_permissions_moduleId_idx" ON "user_module_permissions"("moduleId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catalogo inicial de modulos.
-- `name` es el identificador estable que usa el frontend. El orden de insercion
-- deja los ids 1..8 consecutivos.
INSERT INTO "modules" ("name") VALUES
    ('dashboard'),
    ('calendar'),
    ('events'),
    ('students'),
    ('participations'),
    ('verification'),
    ('users'),
    ('catalogs')
ON CONFLICT ("name") DO NOTHING;

-- Catalogo inicial de tipos de evento academico (nombres en ingles; la
-- interfaz los traduce al espanol).
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
