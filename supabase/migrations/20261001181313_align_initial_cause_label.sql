-- Match the user's initial cause catalog while preserving the cause ID.
UPDATE public.causas
SET descricao = 'Direcionamento fila errada'
WHERE descricao = 'Direcionamento para fila errada'
  AND NOT EXISTS (
    SELECT 1 FROM public.causas existing
    WHERE existing.descricao_normalizada = lower('Direcionamento fila errada')
      AND existing.id <> public.causas.id
  );
