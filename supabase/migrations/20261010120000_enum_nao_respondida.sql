-- Novos valores de enum ficam em migração própria: só podem ser usados depois do commit.
-- NC cujo prazo de aceite (2 dias úteis = 18 horas de expediente) venceu sem resposta (D9).
ALTER TYPE public.status_nc ADD VALUE IF NOT EXISTS 'nao_respondida';
