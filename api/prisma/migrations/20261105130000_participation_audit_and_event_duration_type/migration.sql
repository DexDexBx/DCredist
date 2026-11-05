-- El campo de duracion del evento pasa a llamarse duration_type.
ALTER TABLE "events" RENAME COLUMN "eventType" TO "duration_type";

-- Auditoria de participaciones: quien la creo y quien la modifico por ultima vez.
ALTER TABLE "participations"
  ADD COLUMN "userCreate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "userUpdate" TEXT NOT NULL DEFAULT '';
