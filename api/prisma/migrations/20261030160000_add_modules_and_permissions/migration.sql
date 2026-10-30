-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('NONE', 'VIEW', 'MANAGE');

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_module_permissions" (
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "permission" "PermissionLevel" NOT NULL,

    CONSTRAINT "user_module_permissions_pkey" PRIMARY KEY ("userId","moduleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE INDEX "user_module_permissions_moduleId_idx" ON "user_module_permissions"("moduleId");

-- AddForeignKey
ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catalogo inicial de modulos. `name` es el identificador que usa el frontend.
-- Se inserta aqui ademas del seed para que la tabla nunca quede vacia tras
-- aplicar la migracion.
INSERT INTO "modules" ("id", "name") VALUES
    ('00000000-0000-4000-8000-000000000001', 'dashboard'),
    ('00000000-0000-4000-8000-000000000002', 'calendar'),
    ('00000000-0000-4000-8000-000000000003', 'events'),
    ('00000000-0000-4000-8000-000000000004', 'students'),
    ('00000000-0000-4000-8000-000000000005', 'participations'),
    ('00000000-0000-4000-8000-000000000006', 'certificates'),
    ('00000000-0000-4000-8000-000000000007', 'verification'),
    ('00000000-0000-4000-8000-000000000008', 'users'),
    ('00000000-0000-4000-8000-000000000009', 'catalogs')
ON CONFLICT ("name") DO NOTHING;

-- Rellena la matriz de los usuarios existentes con el preset de su rol.
-- Se deja en SQL para que la migracion sea autosuficiente; el seed vuelve a
-- hacerlo de forma idempotente.
INSERT INTO "user_module_permissions" ("userId", "moduleId", "permission")
SELECT
    u."id",
    m."id",
    CASE u."role"
        WHEN 'ADMIN' THEN
            CASE m."name"
                WHEN 'dashboard' THEN 'VIEW'
                WHEN 'calendar' THEN 'VIEW'
                WHEN 'events' THEN 'MANAGE'
                WHEN 'students' THEN 'MANAGE'
                WHEN 'participations' THEN 'MANAGE'
                WHEN 'certificates' THEN 'MANAGE'
                WHEN 'verification' THEN 'VIEW'
                WHEN 'users' THEN 'MANAGE'
                WHEN 'catalogs' THEN 'MANAGE'
                ELSE 'NONE'
            END
        WHEN 'COORDINATOR' THEN
            CASE m."name"
                WHEN 'dashboard' THEN 'VIEW'
                WHEN 'calendar' THEN 'VIEW'
                WHEN 'events' THEN 'MANAGE'
                WHEN 'students' THEN 'MANAGE'
                WHEN 'participations' THEN 'MANAGE'
                WHEN 'certificates' THEN 'MANAGE'
                WHEN 'verification' THEN 'VIEW'
                ELSE 'NONE'
            END
        WHEN 'ORGANIZER' THEN
            CASE m."name"
                WHEN 'dashboard' THEN 'VIEW'
                WHEN 'calendar' THEN 'VIEW'
                WHEN 'events' THEN 'MANAGE'
                WHEN 'students' THEN 'VIEW'
                WHEN 'participations' THEN 'MANAGE'
                WHEN 'certificates' THEN 'MANAGE'
                WHEN 'verification' THEN 'VIEW'
                ELSE 'NONE'
            END
        WHEN 'OPERATOR' THEN
            CASE m."name"
                WHEN 'dashboard' THEN 'VIEW'
                WHEN 'calendar' THEN 'VIEW'
                WHEN 'events' THEN 'VIEW'
                WHEN 'students' THEN 'VIEW'
                WHEN 'participations' THEN 'MANAGE'
                WHEN 'verification' THEN 'VIEW'
                ELSE 'NONE'
            END
        ELSE
            CASE m."name"
                WHEN 'dashboard' THEN 'VIEW'
                WHEN 'calendar' THEN 'VIEW'
                WHEN 'events' THEN 'VIEW'
                WHEN 'students' THEN 'VIEW'
                WHEN 'participations' THEN 'VIEW'
                WHEN 'verification' THEN 'VIEW'
                ELSE 'NONE'
            END
    END::"PermissionLevel"
FROM "users" u
CROSS JOIN "modules" m
ON CONFLICT ("userId", "moduleId") DO NOTHING;
