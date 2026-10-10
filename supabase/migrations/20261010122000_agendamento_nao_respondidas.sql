-- Agendamento (4.5a): marca como "Não respondida" as NCs com prazo de aceite vencido, a cada 15 minutos.
-- O prazo tem hora (cai sempre dentro do expediente), então o job roda o dia todo; ele é idempotente
-- e usa FOR UPDATE SKIP LOCKED. Extensão instalada com autorização do responsável (10/10).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'sgnc-marcar-nao-respondidas',
  '*/15 * * * *',
  $$SELECT public.marcar_nao_respondidas_v1()$$
);
