-- Las participaciones existentes no deben quedar con autor vacio.
-- Se usa el nombre del usuario con id 1; si no existe, "Usuario 1".
UPDATE "participations" AS p
SET
  "userCreate" = COALESCE(
    (SELECT u."fullName" FROM "users" AS u WHERE u."id" = 1),
    'Usuario 1'
  ),
  "userUpdate" = COALESCE(
    (SELECT u."fullName" FROM "users" AS u WHERE u."id" = 1),
    'Usuario 1'
  )
WHERE p."userCreate" IS NULL OR p."userCreate" = '';

-- Si quedo userCreate pero userUpdate vacio, se copia el autor.
UPDATE "participations"
SET "userUpdate" = "userCreate"
WHERE ("userUpdate" IS NULL OR "userUpdate" = '')
  AND "userCreate" IS NOT NULL
  AND "userCreate" <> '';

-- Valor por defecto para futuras inserciones sin actor explicito.
ALTER TABLE "participations" ALTER COLUMN "userCreate" SET DEFAULT 'Usuario 1';
ALTER TABLE "participations" ALTER COLUMN "userUpdate" SET DEFAULT 'Usuario 1';
