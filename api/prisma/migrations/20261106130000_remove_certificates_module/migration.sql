-- El modulo de certificados ya no forma parte de DCredits V1.
-- Al eliminar el modulo, sus filas en user_module_permissions se borran por
-- la relacion ON DELETE CASCADE.
DELETE FROM "modules"
WHERE "name" = 'certificates';
