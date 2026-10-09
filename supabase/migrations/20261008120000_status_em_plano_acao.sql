-- Status dedicado às NCs críticas cujo plano de ação ainda está em acompanhamento.
-- Fica em migração própria: um valor novo de enum só pode ser usado depois do commit.
ALTER TYPE public.status_nc ADD VALUE IF NOT EXISTS 'em_plano_acao';
