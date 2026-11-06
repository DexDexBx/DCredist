-- Tipo de evento usado por los registros historicos cuando no se conoce el
-- tipo real. Debe existir en el catalogo para que sea seleccionable en la
-- creacion manual y en la importacion masiva historica.
INSERT INTO "event_types" ("name", "status", "updatedAt")
VALUES ('Unspecified', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
