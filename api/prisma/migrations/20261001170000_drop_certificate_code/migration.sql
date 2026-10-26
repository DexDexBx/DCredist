-- Un solo codigo por participacion.
--
-- El certificateCode institucional (por ejemplo "11814") se elimina: el codigo
-- DC (DC-2026-XXXXXX) es el identificador unico de DCredits y es el que se
-- envia para generar certificados. Los 3 registros que aun lo tenían pierden ese
-- dato externo; su verificationCode se conserva intacto.

-- AlterTable
ALTER TABLE "participations" DROP COLUMN "certificateCode";
