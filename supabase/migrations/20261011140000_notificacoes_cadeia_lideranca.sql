-- Notificações (Fase 5) na estrutura organizacional da Fase A (docs/plano-estrutura-organizacional.md, A.9).
--
-- A cadeia de liderança passa por qualquer pessoa com liderados (E4/E7), não só por supervisores:
-- o líder direto pode ser Qualidade ou Adm, e uma NC crítica avisa toda a cadeia até a Diretoria.
-- Mesmo percurso de nc_lidera_colaborador (Fase A). Só pessoas ativas são devolvidas; uma pessoa
-- inativa no meio da cadeia não interrompe a subida.
CREATE OR REPLACE FUNCTION public.lideranca_de(p_colaborador_id uuid, p_cadeia boolean)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  WITH RECURSIVE acima(id, nivel) AS (
    SELECT u.supervisor_id, 1 FROM public.usuarios AS u
     WHERE u.id = p_colaborador_id AND u.supervisor_id IS NOT NULL
    UNION
    SELECT u.supervisor_id, acima.nivel + 1 FROM acima
      JOIN public.usuarios AS u ON u.id = acima.id
     WHERE p_cadeia AND u.supervisor_id IS NOT NULL AND acima.nivel < 50
  )
  SELECT DISTINCT acima.id FROM acima
    JOIN public.usuarios AS u ON u.id = acima.id AND u.ativo
   WHERE acima.id IS DISTINCT FROM p_colaborador_id;
$$;

REVOKE ALL ON FUNCTION public.lideranca_de(uuid, boolean) FROM PUBLIC, anon, authenticated;
