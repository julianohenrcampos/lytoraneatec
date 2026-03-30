
-- Backfill: corrigir flag usar_diaria_exclusiva para registros em FDS/feriado
UPDATE bd_diaria_presencas
SET usar_diaria_exclusiva = true
WHERE presente = true
  AND hora_entrada IS NOT NULL
  AND (EXTRACT(DOW FROM data::date) IN (0, 6) OR data::text IN (SELECT data::text FROM bd_feriados))
  AND (usar_diaria_exclusiva IS NULL OR usar_diaria_exclusiva = false);
