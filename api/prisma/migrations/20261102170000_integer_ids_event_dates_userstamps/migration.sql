-- IDS ENTEROS AUTOINCREMENTALES Y FECHAS DE EVENTO SIN HORA.
--
-- Se reemplazan los identificadores UUID/TEXT por SERIAL (1, 2, 3, ...) en todas
-- las tablas. Como una PK TEXT no se puede convertir en INT conservando filas,
-- las tablas afectadas se recrean: los datos se vuelven a cargar con los seeds.
--
-- Ademas, en `events`:
--   - startDate / endDate pasan a DATE (solo dia, sin hora),
--   - se eliminan startTime / endTime,
--   - se agregan userCreate / userUpdate con el nombre del usuario que creo y
--     que modifico por ultima vez.
--
-- Los catalogos (`professional_schools`, `locations`, `organizers`) ya usan
-- SERIAL y se conservan.

-- DropTable (orden inverso a las dependencias)
DROP TABLE IF EXISTS "user_module_permissions" CASCADE;
DROP TABLE IF EXISTS "participations" CASCADE;
DROP TABLE IF EXISTS "events" CASCADE;
DROP TABLE IF EXISTS "students" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "modules" CASCADE;

-- CreateTable
CREATE TABLE "modules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "universityCode" TEXT NOT NULL,
    "academicDegree" TEXT NOT NULL DEFAULT '',
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
    "description" TEXT NOT NULL DEFAULT '',
    "eventType" "EventType" NOT NULL DEFAULT 'SINGLE_DAY',
    "category" TEXT NOT NULL DEFAULT 'Congreso',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "modality" "EventModality" NOT NULL DEFAULT 'PRESENTIAL',
    "location" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER,
    "organizerId" INTEGER NOT NULL,
    "professionalSchoolId" INTEGER NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
    "participationType" "ParticipationType" NOT NULL DEFAULT 'ASISTENTE',
    "participationDate" TIMESTAMP(3) NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationCode" TEXT NOT NULL,
    "grade" DOUBLE PRECISION,
    "status" "ParticipationStatus" NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_module_permissions" (
    "userId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "permission" "PermissionLevel" NOT NULL,

    CONSTRAINT "user_module_permissions_pkey" PRIMARY KEY ("userId","moduleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_professionalSchoolId_idx" ON "users"("professionalSchoolId");

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
CREATE INDEX "events_organizerId_idx" ON "events"("organizerId");

-- CreateIndex
CREATE INDEX "events_professionalSchoolId_idx" ON "events"("professionalSchoolId");

-- CreateIndex
CREATE UNIQUE INDEX "participations_verificationCode_key" ON "participations"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "participations_eventId_studentId_key" ON "participations"("eventId", "studentId");

-- CreateIndex
CREATE INDEX "participations_studentId_idx" ON "participations"("studentId");

-- CreateIndex
CREATE INDEX "participations_status_idx" ON "participations"("status");

-- CreateIndex
CREATE INDEX "user_module_permissions_moduleId_idx" ON "user_module_permissions"("moduleId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_professionalSchoolId_fkey" FOREIGN KEY ("professionalSchoolId") REFERENCES "professional_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catalogo inicial de modulos. El id lo asigna SERIAL; `name` es el
-- identificador estable que usa el frontend.
INSERT INTO "modules" ("name") VALUES
    ('dashboard'),
    ('calendar'),
    ('events'),
    ('students'),
    ('participations'),
    ('certificates'),
    ('verification'),
    ('users'),
    ('catalogs')
ON CONFLICT ("name") DO NOTHING;
