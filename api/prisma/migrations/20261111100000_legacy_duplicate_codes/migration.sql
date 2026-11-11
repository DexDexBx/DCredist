-- Los codigos historicos pueden repetirse incluso dentro del mismo evento.
-- El codigo visible se conserva tal cual; la identidad tecnica es participation.id.
--
-- Los codigos CURRENT siguen siendo unicos globalmente mediante el indice
-- parcial participations_current_verificationCode_key, que no se toca.
DROP INDEX IF EXISTS "participations_eventId_verificationCode_key";

-- El indice de busqueda por codigo se mantiene.
