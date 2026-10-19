-- Fase 4 do processo de gestão de NCs (docs/plano-processo-gestao-nc.md, decisões de 18 e 19/10):
-- feedback completo, evidência obrigatória na validação e medida só com o feedback aplicado.
--
--   * Feedback: resumo da conversa (obrigatório) e participantes (opcionais por enquanto, decisão de 19/10:
--     a Qualidade escolhe quem participou entre os usuários ativos).
--   * Posicionamento do colaborador: a Qualidade decide se cabe e libera o campo no feedback; o próprio
--     colaborador escreve (opcional) junto com o aceite.
--   * N3: a validação exige ao menos uma evidência anexada na abertura.
--   * N5: a medida só é aprovada depois do feedback da NC aplicado (reprovar continua possível).
-- Migração aditiva: as RPCs anteriores continuam disponíveis; as novas versões delegam a elas.

-- ═══ Feedback: resumo, posicionamento e participantes ═══

ALTER TABLE public.nc_feedbacks
  ADD COLUMN resumo_conversa text CHECK (resumo_conversa IS NULL OR length(btrim(resumo_conversa)) BETWEEN 1 AND 4000),
  ADD COLUMN posicionamento_liberado boolean NOT NULL DEFAULT false,
  ADD COLUMN posicionamento_colaborador text CHECK (posicionamento_colaborador IS NULL OR length(btrim(posicionamento_colaborador)) BETWEEN 1 AND 4000),
  ADD COLUMN posicionamento_em timestamptz,
  ADD CONSTRAINT nc_feedbacks_posicionamento_liberado CHECK (posicionamento_colaborador IS NULL OR posicionamento_liberado);

CREATE TABLE public.nc_feedback_participantes (
  feedback_id bigint NOT NULL REFERENCES public.nc_feedbacks(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  PRIMARY KEY (feedback_id, usuario_id)
);

ALTER TABLE public.nc_feedback_participantes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nc_feedback_participantes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.nc_feedback_participantes TO service_role;

-- ═══ RPC: feedback v6 (v5 + resumo, participantes e liberação do posicionamento) ═══

CREATE OR REPLACE FUNCTION public.registrar_feedback_v6(
  p_nc_id bigint,
  p_responsavel_id uuid,
  p_causa_raiz text,
  p_acao text,
  p_responsavel_acao_id uuid,
  p_prazo_acao date,
  p_combinado text,
  p_resumo_conversa text,
  p_participantes uuid[] DEFAULT '{}',
  p_liberar_posicionamento boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_resumo text := pg_catalog.btrim(coalesce(p_resumo_conversa, ''));
  v_participantes uuid[] := ARRAY(SELECT DISTINCT p FROM unnest(coalesce(p_participantes, '{}')) AS p WHERE p IS NOT NULL);
  v_resultado jsonb;
  v_feedback_id bigint;
BEGIN
  IF v_resumo = '' OR length(v_resumo) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'campo_obrigatorio', 'campo', 'resumo_conversa');
  END IF;
  IF pg_catalog.cardinality(v_participantes) > 20
     OR (SELECT count(*) FROM public.usuarios WHERE id = ANY (v_participantes) AND ativo) <> pg_catalog.cardinality(v_participantes) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'participantes_invalidos', 'campo', 'participantes');
  END IF;

  v_resultado := public.registrar_feedback_v5(p_nc_id, p_responsavel_id, p_causa_raiz, p_acao,
                                              p_responsavel_acao_id, p_prazo_acao, p_combinado);
  IF NOT coalesce((v_resultado ->> 'ok')::boolean, false) THEN RETURN v_resultado; END IF;
  v_feedback_id := (v_resultado ->> 'feedback_id')::bigint;

  UPDATE public.nc_feedbacks
     SET resumo_conversa = v_resumo, posicionamento_liberado = coalesce(p_liberar_posicionamento, false)
   WHERE id = v_feedback_id;
  INSERT INTO public.nc_feedback_participantes (feedback_id, usuario_id)
  SELECT v_feedback_id, p FROM unnest(v_participantes) AS p;

  RETURN v_resultado || pg_catalog.jsonb_build_object('participantes', pg_catalog.cardinality(v_participantes));
END;
$$;

-- ═══ RPC: aceite v5 (v4 + posicionamento opcional, só se a Qualidade liberou) ═══

CREATE OR REPLACE FUNCTION public.aceitar_nc_v5(p_nc_id bigint, p_colaborador_id uuid, p_texto_aceite text, p_posicionamento text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_posicionamento text := nullif(pg_catalog.btrim(coalesce(p_posicionamento, '')), '');
  v_feedback public.nc_feedbacks%ROWTYPE;
  v_resultado jsonb;
BEGIN
  SELECT * INTO v_feedback FROM public.nc_feedbacks WHERE nc_id = p_nc_id ORDER BY versao DESC LIMIT 1 FOR UPDATE;
  IF v_posicionamento IS NOT NULL THEN
    IF v_feedback.id IS NULL OR NOT v_feedback.posicionamento_liberado THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'posicionamento_nao_liberado', 'campo', 'posicionamento');
    END IF;
    IF length(v_posicionamento) > 4000 THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'posicionamento_longo', 'campo', 'posicionamento');
    END IF;
  END IF;

  v_resultado := public.aceitar_nc_v4(p_nc_id, p_colaborador_id, p_texto_aceite);
  IF NOT coalesce((v_resultado ->> 'ok')::boolean, false) THEN RETURN v_resultado; END IF;

  IF v_posicionamento IS NOT NULL THEN
    UPDATE public.nc_feedbacks
       SET posicionamento_colaborador = v_posicionamento, posicionamento_em = pg_catalog.now()
     WHERE id = v_feedback.id;
  END IF;
  RETURN v_resultado || pg_catalog.jsonb_build_object('posicionamento', v_posicionamento IS NOT NULL);
END;
$$;

-- ═══ RPC: validação v5 (N3: exige evidência da abertura) ═══

CREATE OR REPLACE FUNCTION public.validar_nc_com_workflow_v5(
  p_nc_id bigint,
  p_responsavel_id uuid,
  p_origem text,
  p_tipo_nc text,
  p_procedimento text DEFAULT NULL,
  p_procedimento_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  -- Trava a NC antes de conferir as evidências: um anexo removido em paralelo não passa.
  PERFORM 1 FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.evidencias WHERE nc_id = p_nc_id AND feedback_id IS NULL) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'evidencia_ausente', 'campo', 'evidencias');
  END IF;
  RETURN public.validar_nc_com_workflow_v4(p_nc_id, p_responsavel_id, p_origem, p_tipo_nc, p_procedimento, p_procedimento_url);
END;
$$;

-- ═══ RPC: decisão da medida v2 (N5: aprovação só com o feedback aplicado) ═══

CREATE OR REPLACE FUNCTION public.decidir_medida_v2(p_medida_id bigint, p_usuario_id uuid, p_decisao text, p_motivo text, p_tipo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc_id bigint;
BEGIN
  SELECT nc_id INTO v_nc_id FROM public.medidas_disciplinares WHERE id = p_medida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'medida_nao_encontrada'); END IF;
  IF p_decisao = 'aprovar' AND v_nc_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.nao_conformidades WHERE id = v_nc_id AND feedback_aplicado_em IS NULL) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'feedback_pendente');
  END IF;
  RETURN public.decidir_medida_v1(p_medida_id, p_usuario_id, p_decisao, p_motivo, p_tipo);
END;
$$;

-- ═══ Permissões: só o servidor (service_role) executa ═══

REVOKE ALL ON FUNCTION public.registrar_feedback_v6(bigint, uuid, text, text, uuid, date, text, text, uuid[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aceitar_nc_v5(bigint, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_nc_com_workflow_v5(bigint, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decidir_medida_v2(bigint, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_feedback_v6(bigint, uuid, text, text, uuid, date, text, text, uuid[], boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.aceitar_nc_v5(bigint, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_nc_com_workflow_v5(bigint, uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decidir_medida_v2(bigint, uuid, text, text, text) TO service_role;
