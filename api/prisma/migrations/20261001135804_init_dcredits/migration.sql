-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SINGLE_DAY', 'MULTI_DAY');

-- CreateEnum
CREATE TYPE "EventModality" AS ENUM ('PRESENTIAL', 'VIRTUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipationType" AS ENUM ('ASISTENTE', 'PONENTE', 'PANELISTA', 'INVITADO', 'ORGANIZADOR');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('VALID', 'CANCELLED', 'PENDING');

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "universityCode" TEXT NOT NULL,
    "academicDegree" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "professionalSchool" TEXT NOT NULL,
    "headquarters" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "eventType" "EventType" NOT NULL DEFAULT 'SINGLE_DAY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "modality" "EventModality" NOT NULL DEFAULT 'PRESENTIAL',
    "location" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER,
    "organizer" TEXT NOT NULL DEFAULT '',
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "participationType" "ParticipationType" NOT NULL DEFAULT 'ASISTENTE',
    "participationDate" TIMESTAMP(3) NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationCode" TEXT NOT NULL,
    "certificateCode" TEXT,
    "grade" DOUBLE PRECISION,
    "status" "ParticipationStatus" NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_universityCode_key" ON "students"("universityCode");

-- CreateIndex
CREATE INDEX "students_professionalSchool_idx" ON "students"("professionalSchool");

-- CreateIndex
CREATE INDEX "students_headquarters_idx" ON "students"("headquarters");

-- CreateIndex
CREATE INDEX "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE UNIQUE INDEX "events_code_key" ON "events"("code");

-- CreateIndex
CREATE INDEX "events_startDate_idx" ON "events"("startDate");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "participations_verificationCode_key" ON "participations"("verificationCode");

-- CreateIndex
CREATE INDEX "participations_studentId_idx" ON "participations"("studentId");

-- CreateIndex
CREATE INDEX "participations_status_idx" ON "participations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "participations_eventId_studentId_key" ON "participations"("eventId", "studentId");

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
