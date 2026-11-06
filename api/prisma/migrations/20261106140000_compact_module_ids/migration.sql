-- Compacta los ids del catalogo de modulos tras eliminar "certificates".
-- El frontend identifica cada modulo por `name`, no por `id`, y la relacion
-- user_module_permissions.moduleId tiene ON UPDATE CASCADE, asi que la
-- renumeracion conserva todas las matrices de permisos.

-- Paso 1: ids temporales negativos para evitar colisiones de PK mientras se
-- renumera (por ejemplo, 8 -> 7 cuando la fila 7 todavia existe).
WITH renumbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "id") AS "position"
  FROM "modules"
)
UPDATE "modules" AS m
SET "id" = -r."position"
FROM renumbered AS r
WHERE m."id" = r."id";

-- Paso 2: de negativos a positivos consecutivos (1..N).
UPDATE "modules"
SET "id" = -"id";

-- Deja la secuencia alineada para que el siguiente modulo nuevo no choque.
SELECT setval(
  pg_get_serial_sequence('modules', 'id'),
  COALESCE((SELECT MAX("id") FROM "modules"), 1),
  true
);
