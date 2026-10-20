-- Fase 5 do processo de gestão de NCs (docs/plano-processo-gestao-nc.md, decisões de 18 e 19/10):
-- verificação de eficácia em 30 dias, "Não eficaz", "Reaberta" e "Escalada", plano de ação em
-- qualquer NC validada, desfecho da avaliação de justa causa e aviso de ação do plano vencida.
--
--   * Conclusão do plano → "Em verificação" por 30 dias. A Qualidade registra eficaz (NC concluída)
--     ou não eficaz. Nova NC do colaborador com a mesma causa durante a janela sugere "não eficaz";
--     no 30º dia a Qualidade é avisada para registrar o resultado.
--   * "Não eficaz" → a Qualidade decide: Reaberta (nova rodada do plano, que volta a passar pela
--     verificação) ou Escalada para o gestor do departamento do colaborador, que registra o parecer
--     e encerra a NC.
--   * N1: a Qualidade pode abrir plano de ação em NC não crítica a qualquer momento depois da
--     validação, enquanto ela não estiver concluída. A NC crítica continua com plano obrigatório.
--   * N4: a medida "avaliação de justa causa" registra o desfecho (desligado ou mantido), só pela Qualidade.
--   * Ação do plano vencida sem execução: avisa o responsável pela execução e o líder direto dele.
-- Migração aditiva: as RPCs anteriores continuam disponíveis. Única troca de restrição: o CHECK
-- "em_plano_acao exige crítica" passa a aceitar também a NC com plano aberto pela Qualidade.

-- ═══ Colunas ═══

ALTER TABLE public.nao_conformidades
  ADD COLUMN plano_acao_aberto boolean NOT NULL DEFAULT false,
  ADD COLUMN verificacao_inicio timestamptz,
  ADD COLUMN verificacao_ate timestamptz,
  ADD COLUMN verificacao_resultado text CHECK (verificacao_resultado IS NULL OR verificacao_resultado IN ('eficaz', 'nao_eficaz')),
  ADD COLUMN verificacao_observacao text CHECK (verificacao_observacao IS NULL OR length(btrim(verificacao_observacao)) BETWEEN 1 AND 4000),
  ADD COLUMN verificacao_registrada_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN verificacao_registrada_em timestamptz,
  ADD COLUMN escalada_para uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN escalada_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN escalada_em timestamptz,
  ADD COLUMN escalada_motivo text CHECK (escalada_motivo IS NULL OR length(btrim(escalada_motivo)) BETWEEN 10 AND 4000),
  ADD COLUMN escalonamento_parecer text CHECK (escalonamento_parecer IS NULL OR length(btrim(escalonamento_parecer)) BETWEEN 10 AND 4000),
  ADD COLUMN escalonamento_decidido_em timestamptz;

ALTER TABLE public.nao_conformidades DROP CONSTRAINT nao_conformidades_plano_exige_critica;
ALTER TABLE public.nao_conformidades ADD CONSTRAINT nao_conformidades_plano_exige_critica CHECK (
  status <> 'em_plano_acao'::public.status_nc OR critica OR plano_acao_aberto
);

CREATE INDEX nao_conformidades_escalada_para_idx ON public.nao_conformidades (escalada_para) WHERE escalada_para IS NOT NULL;

ALTER TABLE public.planos_acao ADD COLUMN ciclo integer NOT NULL DEFAULT 1 CHECK (ciclo >= 1);

ALTER TABLE public.medidas_disciplinares
  ADD COLUMN desfecho text CHECK (desfecho IS NULL OR desfecho IN ('desligado', 'mantido')),
  ADD COLUMN desfecho_observacao text CHECK (desfecho_observacao IS NULL OR length(btrim(desfecho_observacao)) BETWEEN 10 AND 2000),
  ADD COLUMN desfecho_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN desfecho_em timestamptz,
  ADD CONSTRAINT medidas_desfecho_so_justa_causa CHECK (desfecho IS NULL OR tipo = 'avaliar_justa_causa');

-- ═══ Reincidência: os status novos também são NC validada (contam como ocorrência) ═══

CREATE OR REPLACE FUNCTION public.ocorrencia_no_ciclo(p_colaborador_id uuid, p_causa_id bigint, p_nc_id bigint)
RETURNS TABLE (numero integer, inicio_ciclo date)
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $$
DECLARE
  v_data date;
  v_item record;
  v_inicio date;
  v_n integer := 0;
BEGIN
  SELECT coalesce(nc.data, nc.criado_em::date) INTO v_data FROM public.nao_conformidades AS nc WHERE nc.id = p_nc_id;
  IF NOT FOUND THEN RETURN; END IF;
  FOR v_item IN
    SELECT nc.id, coalesce(nc.data, nc.criado_em::date) AS data
      FROM public.nao_conformidades AS nc
      JOIN public.nc_causas AS rel ON rel.nc_id = nc.id AND rel.causa_id = p_causa_id
     WHERE nc.colaborador_id = p_colaborador_id
       AND (nc.id = p_nc_id OR nc.tipo_nc = 'cobranca')
       AND (nc.id = p_nc_id OR nc.status IN (
             'validada'::public.status_nc, 'aguardando_analise'::public.status_nc, 'aguardando_feedback'::public.status_nc,
             'aguardando_aceite'::public.status_nc, 'nao_respondida'::public.status_nc, 'em_plano_acao'::public.status_nc,
             'concluida'::public.status_nc, 'em_verificacao'::public.status_nc, 'nao_eficaz'::public.status_nc,
             'reaberta'::public.status_nc, 'escalada'::public.status_nc))
       AND (coalesce(nc.data, nc.criado_em::date), nc.id) <= (v_data, p_nc_id)
     ORDER BY 2, 1
  LOOP
    IF v_inicio IS NULL OR v_item.data >= (v_inicio + interval '12 months')::date THEN
      v_inicio := v_item.data;
      v_n := 0;
    END IF;
    v_n := v_n + 1;
  END LOOP;
  numero := v_n;
  inicio_ciclo := v_inicio;
  RETURN NEXT;
END;
$$;

-- ═══ Avisos simples (mesma tabela e regras: sem o autor, uma linha por pessoa e chave, usuário ativo) ═══

CREATE OR REPLACE FUNCTION public.notificar_pessoas(
  p_usuarios uuid[], p_evento text, p_papel text, p_nivel text, p_nc_id bigint,
  p_titulo text, p_mensagem text, p_chave text, p_autor_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_total integer;
BEGIN
  WITH gravadas AS (
    INSERT INTO public.notificacoes AS n (usuario_id, evento, papel_destinatario, nivel, nc_id, titulo, mensagem, link, chave_agrupamento)
    SELECT DISTINCT u.id, p_evento, p_papel, p_nivel, p_nc_id, left(p_titulo, 200), left(p_mensagem, 1000), '/nc/' || p_nc_id, p_chave
      FROM public.usuarios AS u
     WHERE u.id = ANY (coalesce(p_usuarios, '{}')) AND u.ativo AND u.id IS DISTINCT FROM p_autor_id
    ON CONFLICT (usuario_id, chave_agrupamento) DO UPDATE
       SET evento = excluded.evento, papel_destinatario = excluded.papel_destinatario, nivel = excluded.nivel,
           titulo = excluded.titulo, mensagem = excluded.mensagem, link = excluded.link,
           atualizada_em = pg_catalog.now(), lida_em = NULL, resolvida_em = NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_total FROM gravadas;
  RETURN v_total;
END;
$$;

-- Qualidade sem o colaborador da NC (R2/R6).
CREATE OR REPLACE FUNCTION public.qualidade_sem_conflito(p_nc_id bigint)
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT coalesce(array_agg(q), '{}') FROM public.usuarios_qualidade() AS q
   WHERE q IS DISTINCT FROM (SELECT colaborador_id FROM public.nao_conformidades WHERE id = p_nc_id);
$$;

-- ═══ N1: plano de ação em NC não crítica ═══

CREATE OR REPLACE FUNCTION public.abrir_plano_acao_v1(p_nc_id bigint, p_usuario_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_plano public.planos_acao%ROWTYPE;
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_agora timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo
                   AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.critica OR v_nc.plano_acao_aberto THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_ja_aberto');
  END IF;
  -- Validada e ainda não concluída (antes do aceite).
  IF v_nc.status NOT IN ('aguardando_feedback'::public.status_nc, 'aguardando_analise'::public.status_nc,
                         'aguardando_aceite'::public.status_nc, 'nao_respondida'::public.status_nc) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  IF length(v_motivo) < 10 OR length(v_motivo) > 1000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_ausente');
  END IF;

  UPDATE public.nao_conformidades SET plano_acao_aberto = true WHERE id = p_nc_id;
  SELECT * INTO v_plano FROM public.planos_acao WHERE nc_id = p_nc_id FOR UPDATE;
  IF v_plano.id IS NULL THEN
    INSERT INTO public.planos_acao (nc_id, criado_por, atualizado_por) VALUES (p_nc_id, p_usuario_id, p_usuario_id)
    RETURNING * INTO v_plano;
  ELSE
    UPDATE public.planos_acao
       SET status = 'planejamento', motivo_cancelamento = NULL, cancelado_por = NULL, cancelado_em = NULL,
           atualizado_por = p_usuario_id, atualizado_em = v_agora
     WHERE id = v_plano.id;
  END IF;
  INSERT INTO public.plano_acao_acompanhamentos (plano_id, usuario_id, tipo, texto, criado_em)
  VALUES (v_plano.id, p_usuario_id, 'evento', 'Plano de ação aberto: ' || v_motivo, v_agora);
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, v_nc.status, 'Plano de ação aberto: ' || v_motivo, v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id);
END;
$$;

-- Aceite v6: mesmas regras da v4 (prazo, "Não respondida", fora do prazo) e da v5 (posicionamento),
-- e a NC com plano aberto segue para o plano, como a crítica.
CREATE OR REPLACE FUNCTION public.aceitar_nc_v6(p_nc_id bigint, p_colaborador_id uuid, p_texto_aceite text, p_posicionamento text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_feedback public.nc_feedbacks%ROWTYPE;
  v_posicionamento text := nullif(pg_catalog.btrim(coalesce(p_posicionamento, '')), '');
  v_agora timestamptz := pg_catalog.now();
  v_novo_status public.status_nc;
  v_fora_prazo boolean;
  v_com_plano boolean;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id IS DISTINCT FROM p_colaborador_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'colaborador_incorreto');
  END IF;
  IF v_nc.status NOT IN ('aguardando_aceite'::public.status_nc, 'nao_respondida'::public.status_nc) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  SELECT * INTO v_feedback FROM public.nc_feedbacks WHERE nc_id = p_nc_id ORDER BY versao DESC LIMIT 1 FOR UPDATE;
  IF v_posicionamento IS NOT NULL THEN
    IF v_feedback.id IS NULL OR NOT v_feedback.posicionamento_liberado THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'posicionamento_nao_liberado', 'campo', 'posicionamento');
    END IF;
    IF length(v_posicionamento) > 4000 THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'posicionamento_longo', 'campo', 'posicionamento');
    END IF;
  END IF;

  v_fora_prazo := v_nc.status = 'nao_respondida'::public.status_nc
                  OR (v_feedback.prazo_aceite IS NOT NULL AND v_agora > v_feedback.prazo_aceite);
  v_com_plano := v_nc.critica OR v_nc.plano_acao_aberto;
  v_novo_status := CASE WHEN v_com_plano THEN 'em_plano_acao'::public.status_nc ELSE 'concluida'::public.status_nc END;

  UPDATE public.nao_conformidades
     SET status = v_novo_status, texto_aceite = p_texto_aceite, aceito_em = v_agora, aceito_fora_prazo = v_fora_prazo
   WHERE id = p_nc_id;
  IF v_posicionamento IS NOT NULL THEN
    UPDATE public.nc_feedbacks SET posicionamento_colaborador = v_posicionamento, posicionamento_em = v_agora
     WHERE id = v_feedback.id;
  END IF;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_colaborador_id, v_nc.status, v_novo_status,
          CASE WHEN v_fora_prazo THEN 'Aceite formal do colaborador fora do prazo' ELSE 'Aceite formal do colaborador' END
          || CASE WHEN v_com_plano THEN '; segue para o plano de ação' ELSE '' END,
          v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', v_novo_status,
                                       'aceito_fora_prazo', v_fora_prazo, 'posicionamento', v_posicionamento IS NOT NULL);
END;
$$;

-- Marcar ou desmarcar crítica (v3): igual à v2, mas preserva o plano aberto pela Qualidade.
-- Marcar crítica numa NC com plano aberto não reinicia o plano; desmarcar mantém o plano e o status.
CREATE OR REPLACE FUNCTION public.definir_nc_critica_v3(p_nc_id bigint, p_usuario_id uuid, p_critica boolean, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_plano public.planos_acao%ROWTYPE;
  v_resultado jsonb;
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_agora timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF NOT v_nc.plano_acao_aberto THEN
    RETURN public.definir_nc_critica_v2(p_nc_id, p_usuario_id, p_critica, p_motivo);
  END IF;
  SELECT * INTO v_plano FROM public.planos_acao WHERE nc_id = p_nc_id FOR UPDATE;
  IF p_critica THEN
    v_resultado := public.definir_nc_critica_v2(p_nc_id, p_usuario_id, true, p_motivo);
    IF coalesce((v_resultado ->> 'ok')::boolean, false) AND v_plano.id IS NOT NULL THEN
      -- A v2 volta o plano para o planejamento; o plano já em andamento segue na etapa em que estava.
      UPDATE public.planos_acao SET status = v_plano.status WHERE id = v_plano.id;
    END IF;
    RETURN v_resultado;
  END IF;
  -- Desmarcar com plano aberto: as mesmas checagens da v2, sem cancelar o plano nem mudar o status.
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo
                   AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse'); END IF;
  IF pg_catalog.length(v_motivo) < 10 THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_ausente'); END IF;
  IF NOT v_nc.critica THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_critica'); END IF;
  UPDATE public.nao_conformidades
     SET critica = false, critica_motivo = NULL, critica_marcada_por = NULL, critica_marcada_em = NULL
   WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, v_nc.status, 'Criticidade removida (o plano de ação continua): ' || v_motivo, v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', v_nc.status, 'critica', false);
END;
$$;

-- ═══ Plano de ação v2: mesmas regras da v1, com o plano aberto pela Qualidade além da NC crítica ═══

CREATE OR REPLACE FUNCTION public.salvar_plano_acao_v2(
  p_nc_id bigint, p_usuario_id uuid, p_status text, p_causa_raiz text, p_acoes text,
  p_responsavel_execucao_id uuid, p_prazo date, p_execucao text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_plano public.planos_acao%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_causa text := nullif(pg_catalog.btrim(coalesce(p_causa_raiz, '')), '');
  v_acoes text := nullif(pg_catalog.btrim(coalesce(p_acoes, '')), '');
  v_execucao text := nullif(pg_catalog.btrim(coalesce(p_execucao, '')), '');
  v_alterados text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF NOT public.nc_pode_alimentar_plano(p_usuario_id, v_nc.colaborador_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF NOT (v_nc.critica OR v_nc.plano_acao_aberto) THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_critica'); END IF;

  SELECT * INTO v_plano FROM public.planos_acao WHERE nc_id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_nao_encontrado'); END IF;
  IF v_plano.status IN ('concluido', 'cancelado') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_encerrado');
  END IF;
  IF p_status NOT IN ('planejamento', 'em_execucao', 'em_acompanhamento') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'etapa_invalida');
  END IF;
  IF p_status IN ('em_execucao', 'em_acompanhamento')
     AND (v_causa IS NULL OR v_acoes IS NULL OR p_responsavel_execucao_id IS NULL OR p_prazo IS NULL) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'planejamento_incompleto');
  END IF;
  IF p_status = 'em_acompanhamento' AND v_execucao IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'execucao_incompleta');
  END IF;
  IF p_responsavel_execucao_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = p_responsavel_execucao_id AND ativo
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'responsavel_invalido');
  END IF;

  IF v_plano.status IS DISTINCT FROM p_status THEN v_alterados := v_alterados || ('etapa: ' || p_status); END IF;
  IF v_plano.causa_raiz IS DISTINCT FROM v_causa THEN v_alterados := v_alterados || 'causa raiz'::text; END IF;
  IF v_plano.acoes IS DISTINCT FROM v_acoes THEN v_alterados := v_alterados || 'ações planejadas'::text; END IF;
  IF v_plano.responsavel_execucao_id IS DISTINCT FROM p_responsavel_execucao_id THEN v_alterados := v_alterados || 'responsável pela execução'::text; END IF;
  IF v_plano.prazo IS DISTINCT FROM p_prazo THEN v_alterados := v_alterados || 'prazo'::text; END IF;
  IF v_plano.execucao IS DISTINCT FROM v_execucao THEN v_alterados := v_alterados || 'execução'::text; END IF;

  IF pg_catalog.cardinality(v_alterados) = 0 THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'alterado', false);
  END IF;

  UPDATE public.planos_acao
  SET status = p_status, causa_raiz = v_causa, acoes = v_acoes,
      responsavel_execucao_id = p_responsavel_execucao_id, prazo = p_prazo, execucao = v_execucao,
      atualizado_por = p_usuario_id, atualizado_em = v_agora
  WHERE id = v_plano.id;

  INSERT INTO public.plano_acao_acompanhamentos (plano_id, usuario_id, tipo, texto, criado_em)
  VALUES (v_plano.id, p_usuario_id, 'evento', 'Plano atualizado (' || pg_catalog.array_to_string(v_alterados, ', ') || ')', v_agora);

  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'alterado', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_acompanhamento_plano_v2(p_nc_id bigint, p_usuario_id uuid, p_texto text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_plano public.planos_acao%ROWTYPE;
  v_texto text := pg_catalog.btrim(coalesce(p_texto, ''));
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF NOT public.nc_pode_alimentar_plano(p_usuario_id, v_nc.colaborador_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF NOT (v_nc.critica OR v_nc.plano_acao_aberto) THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_critica'); END IF;
  SELECT * INTO v_plano FROM public.planos_acao WHERE nc_id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_nao_encontrado'); END IF;
  IF v_plano.status IN ('concluido', 'cancelado') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_encerrado');
  END IF;
  IF pg_catalog.length(v_texto) < 3 OR pg_catalog.length(v_texto) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'texto_invalido');
  END IF;
  INSERT INTO public.plano_acao_acompanhamentos (plano_id, usuario_id, tipo, texto)
  VALUES (v_plano.id, p_usuario_id, 'registro', v_texto);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id);
END;
$$;

-- ═══ Conclusão do plano v2: abre a verificação de eficácia de 30 dias ═══

CREATE OR REPLACE FUNCTION public.concluir_plano_acao_v2(p_nc_id bigint, p_usuario_id uuid, p_conclusao text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_plano public.planos_acao%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_texto text := pg_catalog.btrim(coalesce(p_conclusao, ''));
  v_ate timestamptz := pg_catalog.now() + interval '30 days';
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo
                   AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status NOT IN ('em_plano_acao'::public.status_nc, 'reaberta'::public.status_nc) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  SELECT * INTO v_plano FROM public.planos_acao WHERE nc_id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_nao_encontrado'); END IF;
  IF v_plano.responsavel_execucao_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'verificador_executor');
  END IF;
  IF v_plano.status <> 'em_acompanhamento' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_nao_executado');
  END IF;
  -- Na rodada reaberta, vale só o acompanhamento registrado depois da reabertura.
  IF NOT EXISTS (SELECT 1 FROM public.plano_acao_acompanhamentos WHERE plano_id = v_plano.id AND tipo = 'registro'
                   AND id > coalesce((SELECT max(id) FROM public.plano_acao_acompanhamentos
                                       WHERE plano_id = v_plano.id AND tipo = 'evento' AND texto LIKE 'NC reaberta%'), 0)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_acompanhamento');
  END IF;
  IF pg_catalog.length(v_texto) < 10 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'verificacao_ausente');
  END IF;

  UPDATE public.planos_acao
     SET status = 'concluido', verificacao_eficacia = v_texto, concluido_por = p_usuario_id,
         concluido_em = v_agora, atualizado_por = p_usuario_id, atualizado_em = v_agora
   WHERE id = v_plano.id;
  INSERT INTO public.plano_acao_acompanhamentos (plano_id, usuario_id, tipo, texto, criado_em)
  VALUES (v_plano.id, p_usuario_id, 'evento', 'Plano concluído; verificação de eficácia em 30 dias', v_agora);
  UPDATE public.nao_conformidades
     SET status = 'em_verificacao'::public.status_nc, verificacao_inicio = v_agora, verificacao_ate = v_ate,
         verificacao_resultado = NULL, verificacao_observacao = NULL, verificacao_registrada_por = NULL, verificacao_registrada_em = NULL
   WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, 'em_verificacao'::public.status_nc,
          'Plano concluído; verificação de eficácia até ' || pg_catalog.to_char(v_ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'), v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', 'em_verificacao', 'verificacao_ate', v_ate);
END;
$$;

-- ═══ Verificação de eficácia: eficaz (concluída) ou não eficaz ═══

CREATE OR REPLACE FUNCTION public.registrar_verificacao_v1(p_nc_id bigint, p_usuario_id uuid, p_resultado text, p_observacao text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_obs text := nullif(pg_catalog.btrim(coalesce(p_observacao, '')), '');
  v_agora timestamptz := pg_catalog.now();
  v_novo public.status_nc;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo
                   AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status <> 'em_verificacao'::public.status_nc THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  IF EXISTS (SELECT 1 FROM public.planos_acao WHERE nc_id = p_nc_id AND responsavel_execucao_id = p_usuario_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'verificador_executor');
  END IF;
  IF p_resultado NOT IN ('eficaz', 'nao_eficaz') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'resultado_invalido', 'campo', 'resultado');
  END IF;
  IF (p_resultado = 'nao_eficaz' AND (v_obs IS NULL OR length(v_obs) < 10)) OR length(coalesce(v_obs, '')) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'observacao_ausente', 'campo', 'observacao');
  END IF;

  v_novo := CASE WHEN p_resultado = 'eficaz' THEN 'concluida'::public.status_nc ELSE 'nao_eficaz'::public.status_nc END;
  UPDATE public.nao_conformidades
     SET status = v_novo, verificacao_resultado = p_resultado, verificacao_observacao = v_obs,
         verificacao_registrada_por = p_usuario_id, verificacao_registrada_em = v_agora
   WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, v_novo,
          CASE WHEN p_resultado = 'eficaz' THEN 'Verificação de eficácia: eficaz' ELSE 'Verificação de eficácia: não eficaz' END
            || coalesce('. ' || v_obs, ''), v_agora);
  PERFORM public.resolver_pendencias(p_nc_id, 'verificacao');
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', v_novo);
END;
$$;

-- ═══ Não eficaz: a Qualidade reabre (nova rodada do plano) ou escala ao gestor do departamento ═══

CREATE OR REPLACE FUNCTION public.decidir_nao_eficaz_v1(p_nc_id bigint, p_usuario_id uuid, p_decisao text, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_plano public.planos_acao%ROWTYPE;
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_agora timestamptz := pg_catalog.now();
  v_gestor uuid;
  v_gestor_nome text;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo
                   AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status <> 'nao_eficaz'::public.status_nc THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  IF p_decisao NOT IN ('reabrir', 'escalar') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'decisao_invalida');
  END IF;
  IF length(v_motivo) < 10 OR length(v_motivo) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_ausente', 'campo', 'motivo');
  END IF;

  IF p_decisao = 'reabrir' THEN
    SELECT * INTO v_plano FROM public.planos_acao WHERE nc_id = p_nc_id FOR UPDATE;
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_nao_encontrado'); END IF;
    -- Nova rodada no mesmo plano: o planejamento anterior fica como base; execução e conclusão recomeçam.
    UPDATE public.planos_acao
       SET status = 'planejamento', ciclo = ciclo + 1, execucao = NULL, verificacao_eficacia = NULL,
           concluido_por = NULL, concluido_em = NULL, atualizado_por = p_usuario_id, atualizado_em = v_agora
     WHERE id = v_plano.id;
    INSERT INTO public.plano_acao_acompanhamentos (plano_id, usuario_id, tipo, texto, criado_em)
    VALUES (v_plano.id, p_usuario_id, 'evento', 'NC reaberta (rodada ' || (v_plano.ciclo + 1) || '): ' || v_motivo, v_agora);
    UPDATE public.nao_conformidades SET status = 'reaberta'::public.status_nc WHERE id = p_nc_id;
    INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
    VALUES (p_nc_id, p_usuario_id, v_nc.status, 'reaberta'::public.status_nc, 'NC reaberta para novo plano: ' || v_motivo, v_agora);
    RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', 'reaberta');
  END IF;

  -- Escalada: gestor (responsável) do departamento do colaborador analisado.
  SELECT d.responsavel_id, u.nome INTO v_gestor, v_gestor_nome
    FROM public.usuarios AS c
    JOIN public.departamentos AS d ON d.id = c.departamento_id
    LEFT JOIN public.usuarios AS u ON u.id = d.responsavel_id AND u.ativo
   WHERE c.id = v_nc.colaborador_id;
  IF v_gestor IS NULL OR v_gestor_nome IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_gestor_departamento');
  END IF;
  IF v_gestor = v_nc.colaborador_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'gestor_e_colaborador');
  END IF;
  UPDATE public.nao_conformidades
     SET status = 'escalada'::public.status_nc, escalada_para = v_gestor, escalada_por = p_usuario_id,
         escalada_em = v_agora, escalada_motivo = v_motivo
   WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, 'escalada'::public.status_nc,
          'Escalada para ' || v_gestor_nome || ' (gestor do departamento): ' || v_motivo, v_agora);
  PERFORM public.notificar_pessoas(ARRAY[v_gestor], 'nc_escalada', 'lider', 'atencao', p_nc_id,
    'NC #' || p_nc_id || ' escalada para você', 'A verificação foi não eficaz. Registre o seu parecer para encerrar a NC.',
    'escalada:' || p_nc_id, p_usuario_id);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', 'escalada', 'gestor', v_gestor_nome);
END;
$$;

-- O gestor do departamento registra o parecer e a NC é encerrada.
CREATE OR REPLACE FUNCTION public.decidir_escalonamento_v1(p_nc_id bigint, p_usuario_id uuid, p_parecer text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_parecer text := pg_catalog.btrim(coalesce(p_parecer, ''));
  v_agora timestamptz := pg_catalog.now();
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status <> 'escalada'::public.status_nc THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  IF v_nc.escalada_para IS DISTINCT FROM p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF length(v_parecer) < 10 OR length(v_parecer) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_ausente', 'campo', 'parecer');
  END IF;
  UPDATE public.nao_conformidades
     SET status = 'concluida'::public.status_nc, escalonamento_parecer = v_parecer, escalonamento_decidido_em = v_agora
   WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, 'concluida'::public.status_nc, 'Encerrada pelo gestor do departamento: ' || v_parecer, v_agora);
  PERFORM public.resolver_pendencias(p_nc_id, 'escalada');
  PERFORM public.notificar_pessoas(public.qualidade_sem_conflito(p_nc_id), 'escalada_decidida', 'qualidade', 'normal', p_nc_id,
    'NC #' || p_nc_id || ' encerrada pelo gestor', left(v_parecer, 300), NULL, p_usuario_id);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', 'concluida');
END;
$$;

-- ═══ N4: desfecho da avaliação de justa causa ═══

CREATE OR REPLACE FUNCTION public.registrar_desfecho_medida_v1(p_medida_id bigint, p_usuario_id uuid, p_desfecho text, p_observacao text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_medida public.medidas_disciplinares%ROWTYPE;
  v_obs text := pg_catalog.btrim(coalesce(p_observacao, ''));
BEGIN
  SELECT * INTO v_medida FROM public.medidas_disciplinares WHERE id = p_medida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'medida_nao_encontrada'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo
                   AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_medida.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_medida.tipo <> 'avaliar_justa_causa' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'tipo_invalido');
  END IF;
  IF v_medida.status NOT IN ('aprovada', 'aplicada') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_medida.status);
  END IF;
  IF v_medida.desfecho IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'desfecho_registrado');
  END IF;
  IF p_desfecho NOT IN ('desligado', 'mantido') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'desfecho_invalido', 'campo', 'desfecho');
  END IF;
  IF length(v_obs) < 10 OR length(v_obs) > 2000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_ausente', 'campo', 'observacao');
  END IF;
  UPDATE public.medidas_disciplinares
     SET desfecho = p_desfecho, desfecho_observacao = v_obs, desfecho_por = p_usuario_id, desfecho_em = pg_catalog.now()
   WHERE id = p_medida_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'medida_id', p_medida_id, 'desfecho', p_desfecho);
END;
$$;

-- ═══ Job: fim da janela de verificação, nova NC da mesma causa na janela e ação do plano vencida ═══
-- Só de segunda a sexta, 9h–18h; cada aviso sai uma vez (chave por NC ou por plano e rodada).

CREATE OR REPLACE FUNCTION public.verificacao_eficacia_job_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_local timestamp := pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo';
  v_hoje date := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_item record;
  v_fim integer := 0;
  v_alerta integer := 0;
  v_vencida integer := 0;
BEGIN
  IF pg_catalog.date_part('isodow', v_local) IN (6, 7) OR v_local::time < time '09:00' OR v_local::time >= time '18:00' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'fora_do_expediente', true);
  END IF;

  -- 30º dia: a Qualidade registra o resultado.
  FOR v_item IN
    SELECT nc.id FROM public.nao_conformidades AS nc
     WHERE nc.status = 'em_verificacao' AND nc.verificacao_ate <= pg_catalog.now()
       AND NOT EXISTS (SELECT 1 FROM public.notificacoes AS n WHERE n.chave_agrupamento = 'verificacao:' || nc.id AND n.nivel = 'urgente')
  LOOP
    PERFORM public.notificar_pessoas(public.qualidade_sem_conflito(v_item.id), 'verificacao_pronta', 'qualidade', 'urgente', v_item.id,
      'Registre a verificação de eficácia (NC #' || v_item.id || ')', 'A janela de 30 dias terminou. Registre se o plano foi eficaz.',
      'verificacao:' || v_item.id);
    v_fim := v_fim + 1;
  END LOOP;

  -- Nova NC validada do mesmo colaborador e da mesma causa durante a janela: sugere "não eficaz".
  FOR v_item IN
    SELECT DISTINCT nc.id, nova.id AS nova_id
      FROM public.nao_conformidades AS nc
      JOIN public.nc_causas AS c1 ON c1.nc_id = nc.id
      JOIN public.nc_causas AS c2 ON c2.causa_id = c1.causa_id AND c2.nc_id <> nc.id
      JOIN public.nao_conformidades AS nova ON nova.id = c2.nc_id
     WHERE nc.status = 'em_verificacao' AND nova.colaborador_id = nc.colaborador_id
       AND nova.validado_em >= nc.verificacao_inicio
       AND NOT EXISTS (SELECT 1 FROM public.notificacoes AS n WHERE n.chave_agrupamento = 'verificacao:' || nc.id)
  LOOP
    PERFORM public.notificar_pessoas(public.qualidade_sem_conflito(v_item.id), 'verificacao_alerta', 'qualidade', 'atencao', v_item.id,
      'Possível plano não eficaz (NC #' || v_item.id || ')',
      'A NC #' || v_item.nova_id || ', da mesma causa e do mesmo colaborador, foi validada durante a verificação.',
      'verificacao:' || v_item.id);
    v_alerta := v_alerta + 1;
  END LOOP;

  -- Ação do plano vencida sem execução: responsável pela execução e o líder direto dele.
  FOR v_item IN
    SELECT p.id, p.nc_id, p.ciclo, p.responsavel_execucao_id, p.prazo, u.nome
      FROM public.planos_acao AS p
      JOIN public.usuarios AS u ON u.id = p.responsavel_execucao_id
     WHERE p.status IN ('planejamento', 'em_execucao') AND p.prazo IS NOT NULL AND p.prazo < v_hoje
       AND NOT EXISTS (SELECT 1 FROM public.notificacoes AS n
                        WHERE n.chave_agrupamento = 'plano_vencido:' || p.id || ':' || p.ciclo)
  LOOP
    PERFORM public.notificar_pessoas(ARRAY[v_item.responsavel_execucao_id], 'plano_vencido', 'responsavel_acao', 'critica', v_item.nc_id,
      'Ação do plano vencida (NC #' || v_item.nc_id || ')',
      'O prazo da ação venceu em ' || pg_catalog.to_char(v_item.prazo, 'DD/MM/YYYY') || ' sem a execução registrada.',
      'plano_vencido:' || v_item.id || ':' || v_item.ciclo);
    PERFORM public.notificar_pessoas(ARRAY(SELECT l FROM public.lideranca_de(v_item.responsavel_execucao_id, false) AS l),
      'plano_vencido', 'lider', 'critica', v_item.nc_id,
      'Ação do plano vencida (NC #' || v_item.nc_id || ')',
      'A ação sob responsabilidade de ' || v_item.nome || ' venceu em ' || pg_catalog.to_char(v_item.prazo, 'DD/MM/YYYY') || ' sem execução.',
      'plano_vencido:' || v_item.id || ':' || v_item.ciclo);
    v_vencida := v_vencida + 1;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'fim_janela', v_fim, 'alerta_reincidencia', v_alerta, 'plano_vencido', v_vencida);
END;
$$;

SELECT cron.schedule('sgnc-verificacao-eficacia', '*/15 * * * *', $$SELECT public.verificacao_eficacia_job_v1()$$);

-- ═══ Permissões: só o servidor (service_role) e o job executam ═══

REVOKE ALL ON FUNCTION public.ocorrencia_no_ciclo(uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_pessoas(uuid[], text, text, text, bigint, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qualidade_sem_conflito(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.abrir_plano_acao_v1(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.definir_nc_critica_v3(bigint, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aceitar_nc_v6(bigint, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salvar_plano_acao_v2(bigint, uuid, text, text, text, uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_acompanhamento_plano_v2(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.concluir_plano_acao_v2(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_verificacao_v1(bigint, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decidir_nao_eficaz_v1(bigint, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decidir_escalonamento_v1(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_desfecho_medida_v1(bigint, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verificacao_eficacia_job_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_plano_acao_v1(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.definir_nc_critica_v3(bigint, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.aceitar_nc_v6(bigint, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.salvar_plano_acao_v2(bigint, uuid, text, text, text, uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_acompanhamento_plano_v2(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.concluir_plano_acao_v2(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_verificacao_v1(bigint, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decidir_nao_eficaz_v1(bigint, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decidir_escalonamento_v1(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_desfecho_medida_v1(bigint, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verificacao_eficacia_job_v1() TO service_role;
