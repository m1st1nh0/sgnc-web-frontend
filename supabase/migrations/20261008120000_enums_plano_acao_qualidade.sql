-- Novos valores de enum ficam em migração própria: só podem ser usados depois do commit.
-- Status dedicado às NCs críticas cujo plano de ação ainda está em acompanhamento.
ALTER TYPE public.status_nc ADD VALUE IF NOT EXISTS 'em_plano_acao';
-- Papel da Qualidade, separado do Administrador do sistema ('adm').
ALTER TYPE public.papel_usuario ADD VALUE IF NOT EXISTS 'qualidade';
