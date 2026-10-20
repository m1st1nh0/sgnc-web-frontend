-- Fase 5 do processo de gestão de NCs: valores novos de status, em migração própria
-- (um valor novo de enum não pode ser usado na mesma transação em que é criado).
--   em_verificacao: plano concluído, janela de 30 dias para verificar a eficácia;
--   nao_eficaz:     verificação registrada como não eficaz, aguardando a decisão da Qualidade;
--   reaberta:       nova rodada do plano de ação depois de "não eficaz";
--   escalada:       encaminhada ao gestor do departamento depois de "não eficaz".
ALTER TYPE public.status_nc ADD VALUE IF NOT EXISTS 'em_verificacao';
ALTER TYPE public.status_nc ADD VALUE IF NOT EXISTS 'nao_eficaz';
ALTER TYPE public.status_nc ADD VALUE IF NOT EXISTS 'reaberta';
ALTER TYPE public.status_nc ADD VALUE IF NOT EXISTS 'escalada';
