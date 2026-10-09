-- Separação entre Administrador do sistema ('adm') e Qualidade ('qualidade'),
-- e trilha auditável da montagem das equipes.
--
-- 'adm'       : gerencia usuários e acessos e também exerce a Qualidade.
-- 'qualidade' : exercício pleno da Qualidade (NCs, causas, plano de ação, equipes).

-- 1. Migração dos perfis atuais: o administrador do sistema permanece 'adm';
--    os demais administradores passam a ser da Qualidade.
UPDATE public.usuarios
SET papel = 'qualidade'::public.papel_usuario
WHERE papel = 'adm'::public.papel_usuario
  AND id <> '50cb9b5d-cb19-45e4-b79f-016470fd6750';

-- O onboarding é por papel: quem mudou de papel mantém o progresso já registrado.
UPDATE public.onboarding_execucoes oe
SET papel = 'qualidade'::public.papel_usuario
FROM public.usuarios u
WHERE u.id = oe.usuario_id
  AND u.papel = 'qualidade'::public.papel_usuario
  AND oe.papel = 'adm'::public.papel_usuario;

-- 2. Políticas de leitura legadas (defesa em profundidade): Qualidade vê o mesmo que o adm via.
DROP POLICY IF EXISTS usuarios_select_escopo ON public.usuarios;
CREATE POLICY usuarios_select_escopo ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR private.meu_papel() IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)
    OR supervisor_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS nc_select_escopo ON public.nao_conformidades;
CREATE POLICY nc_select_escopo ON public.nao_conformidades
  FOR SELECT TO authenticated
  USING (
    private.meu_papel() IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)
    OR aberto_por = (SELECT auth.uid())
    OR (
      status = ANY (ARRAY['aguardando_feedback', 'aguardando_analise', 'aguardando_aceite', 'em_plano_acao', 'concluida']::public.status_nc[])
      AND (colaborador_id = (SELECT auth.uid()) OR private.e_meu_subordinado(colaborador_id))
    )
  );

DROP POLICY IF EXISTS medidas_select_escopo ON public.medidas_disciplinares;
CREATE POLICY medidas_select_escopo ON public.medidas_disciplinares
  FOR SELECT TO authenticated
  USING (
    private.meu_papel() IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)
    OR colaborador_id = (SELECT auth.uid())
    OR private.e_meu_subordinado(colaborador_id)
  );

-- 3. Histórico de equipes: somente inserção, inclusive para o service role.
CREATE TABLE public.historico_equipes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  alterado_por uuid NOT NULL,
  papel_anterior public.papel_usuario,
  papel_novo public.papel_usuario,
  supervisor_anterior uuid,
  supervisor_novo uuid,
  origem text NOT NULL CHECK (origem IN ('equipes', 'cadastro')),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX historico_equipes_usuario_idx ON public.historico_equipes (usuario_id, criado_em DESC);

ALTER TABLE public.historico_equipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY historico_equipes_explicit_deny ON public.historico_equipes
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.historico_equipes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.historico_equipes TO service_role;
REVOKE ALL ON SEQUENCE public.historico_equipes_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.historico_equipes_id_seq TO service_role;

-- 4. Montagem de equipes: mover uma pessoa de liderança e/ou alternar entre Supervisor e
--    Funcionário, de forma atômica e registrada. Perfis de Qualidade/adm ficam fora das equipes
--    e só mudam pela gestão de usuários (Administrador do sistema).
CREATE OR REPLACE FUNCTION public.alterar_equipe_v1(
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
  IF v_alvo.papel NOT IN ('supervisor'::public.papel_usuario, 'funcionario'::public.papel_usuario) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'papel_fora_das_equipes');
  END IF;
  IF p_papel IS NOT NULL AND p_papel NOT IN ('supervisor', 'funcionario') THEN
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

REVOKE ALL ON FUNCTION public.alterar_equipe_v1(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_equipe_v1(uuid, uuid, uuid, text) TO service_role;
