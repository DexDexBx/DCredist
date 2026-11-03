-- PADRON SIN GRADO ACADEMICO.
--
-- `students.academicDegree` no existe en el dominio de DCredits: el padron solo
-- guarda codigo universitario, nombres, escuela, sede y estado.
--
-- Se reafirma ademas la unicidad del codigo universitario. La columna ya era
-- UNIQUE desde el esquema inicial; el indice idempotente protege bases donde
-- el indice se haya perdido.

-- Unicidad del codigo universitario: no se admiten duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS "students_universityCode_key" ON "students"("universityCode");

-- DropColumn
ALTER TABLE "students" DROP COLUMN "academicDegree";
