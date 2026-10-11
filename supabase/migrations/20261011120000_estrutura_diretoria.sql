-- Estrutura organizacional (plano docs/plano-estrutura-organizacional.md, Fase A).
--
-- Perfil é permissão; posição é a liderança (supervisor_id). Todos têm liderança,
-- inclusive Qualidade e Administrador, exceto os membros da Diretoria, que ficam no topo.
-- A cadeia de liderança passa por qualquer pessoa com liderados.

-- 1. Membros da Diretoria: topo da estrutura, sem liderança (E3, E7).
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS diretoria boolean NOT NULL DEFAULT false;

-- 2. Cadeia acima do colaborador: sobe por qualquer pessoa (antes só por supervisores e
--    nunca a partir de Qualidade/adm). Continua exigindo que quem consulta seja um
--    supervisor ativo; Qualidade e adm já têm a visão organizacional.
CREATE OR REPLACE FUNCTION public.nc_lidera_colaborador(p_usuario_id uuid, p_colaborador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH RECURSIVE acima(id, nivel) AS (
    SELECT u.supervisor_id, 1
    FROM public.usuarios u
    WHERE u.id = p_colaborador_id AND u.supervisor_id IS NOT NULL
    UNION
    SELECT u.supervisor_id, a.nivel + 1
    FROM acima a
    JOIN public.usuarios u ON u.id = a.id
    WHERE u.supervisor_id IS NOT NULL AND a.nivel < 50
  )
  SELECT p_usuario_id IS NOT NULL
    AND p_usuario_id IS DISTINCT FROM p_colaborador_id
    AND EXISTS (
      SELECT 1 FROM acima a
      JOIN public.usuarios u ON u.id = a.id
      WHERE a.id = p_usuario_id AND u.papel = 'supervisor'::public.papel_usuario AND u.ativo
    );
$$;

-- 3. Montagem de equipes v2: qualquer pessoa pode ser movida, inclusive Qualidade e adm.
--    Membros da Diretoria ficam no topo e não recebem liderança por aqui.
--    A troca de perfil continua limitada a Supervisor <-> Colaborador.
CREATE OR REPLACE FUNCTION public.alterar_equipe_v2(
  p_usuario_id uuid,
  p_alterado_por uuid,
  p_supervisor_id uuid,
  p_papel text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_alvo public.usuarios%ROWTYPE;
  v_papel public.papel_usuario;
  v_supervisor uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = p_alterado_por AND ativo
      AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  SELECT * INTO v_alvo FROM public.usuarios WHERE id = p_usuario_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'usuario_nao_encontrado'); END IF;
  IF v_alvo.diretoria THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'diretoria_no_topo');
  END IF;
  IF p_papel IS NOT NULL AND (
    p_papel NOT IN ('supervisor', 'funcionario')
    OR v_alvo.papel NOT IN ('supervisor'::public.papel_usuario, 'funcionario'::public.papel_usuario)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'papel_invalido');
  END IF;

  v_papel := coalesce(p_papel::public.papel_usuario, v_alvo.papel);
  v_supervisor := coalesce(p_supervisor_id, v_alvo.supervisor_id);
  IF v_supervisor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'lideranca_obrigatoria');
  END IF;
  IF v_papel = v_alvo.papel AND v_supervisor IS NOT DISTINCT FROM v_alvo.supervisor_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_alteracao');
  END IF;

  IF v_supervisor IS DISTINCT FROM v_alvo.supervisor_id THEN
    IF v_supervisor = p_usuario_id OR NOT EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = v_supervisor AND ativo
        AND papel IN ('supervisor'::public.papel_usuario, 'qualidade'::public.papel_usuario, 'adm'::public.papel_usuario)
    ) THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'lideranca_invalida');
    END IF;
    IF EXISTS (
      WITH RECURSIVE abaixo(id) AS (
        SELECT id FROM public.usuarios WHERE supervisor_id = p_usuario_id
        UNION
        SELECT u.id FROM public.usuarios u JOIN abaixo a ON u.supervisor_id = a.id
      )
      SELECT 1 FROM abaixo WHERE id = v_supervisor
    ) THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'ciclo');
    END IF;
  END IF;

  IF v_alvo.papel = 'supervisor'::public.papel_usuario AND v_papel = 'funcionario'::public.papel_usuario
     AND EXISTS (SELECT 1 FROM public.usuarios WHERE supervisor_id = p_usuario_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'possui_liderados');
  END IF;

  UPDATE public.usuarios SET papel = v_papel, supervisor_id = v_supervisor WHERE id = p_usuario_id;
  INSERT INTO public.historico_equipes
    (usuario_id, alterado_por, papel_anterior, papel_novo, supervisor_anterior, supervisor_novo, origem)
  VALUES
    (p_usuario_id, p_alterado_por, v_alvo.papel, v_papel, v_alvo.supervisor_id, v_supervisor, 'equipes');

  RETURN pg_catalog.jsonb_build_object('ok', true, 'usuario_id', p_usuario_id, 'papel', v_papel, 'supervisor_id', v_supervisor);
END;
$$;

REVOKE ALL ON FUNCTION public.alterar_equipe_v2(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_equipe_v2(uuid, uuid, uuid, text) TO service_role;
