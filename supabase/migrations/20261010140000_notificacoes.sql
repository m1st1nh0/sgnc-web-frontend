-- Fase 5 do retorno da diretoria: notificações dentro do aplicativo (D7, D9, D10, D12, D13, D16–D22).
--
-- Matriz evento × destinatário e regras R1–R7 do plano, aplicadas num só lugar (notificar_evento).
-- Os eventos são disparados por triggers nas tabelas que cada RPC já grava (historico_nc, planos_acao,
-- plano_acao_acompanhamentos, medidas_disciplinares, solicitacoes_causa e a marcação de crítica):
-- a notificação nasce na MESMA transação do evento, sem reescrever cada RPC.
--
--   R1 Quem executou a ação nunca é notificado dela.
--   R2 O colaborador da NC (acusado) nunca recebe a versão "Qualidade"; recebe a pessoal ou nada.
--   R3 Uma notificação por pessoa por evento: acusado > responsável pela ação > líder > quem abriu > Qualidade.
--   R4 Pendências são resolvidas quando acabam (ex.: aceite resolve os avisos de aceite pendente).
--   R5 Só notifica quem pode abrir a NC (Qualidade, acusado, liderança do acusado, quem abriu).
--   R6 "Qualidade" = papéis qualidade e adm.
--   R7 "Líder" = supervisor direto; em NC crítica, toda a cadeia acima (D17).
-- Lembretes do aceite (D18, D22): normal → atenção (9h do dia útil seguinte) → urgente (4 h de expediente
-- antes do prazo) → crítica (vencido), sempre atualizando a mesma notificação. Só de segunda a sexta, 9h–18h.

-- ═══ Tabela ═══

CREATE TABLE public.notificacoes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  evento text NOT NULL,
  papel_destinatario text NOT NULL
    CHECK (papel_destinatario IN ('qualidade', 'acusado', 'lider', 'autor', 'responsavel_acao', 'solicitante')),
  nivel text NOT NULL DEFAULT 'normal' CHECK (nivel IN ('normal', 'atencao', 'urgente', 'critica')),
  nc_id bigint REFERENCES public.nao_conformidades(id) ON DELETE CASCADE,
  medida_id bigint REFERENCES public.medidas_disciplinares(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 200),
  mensagem text NOT NULL CHECK (length(mensagem) BETWEEN 1 AND 1000),
  link text,
  chave_agrupamento text,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  lida_em timestamptz,
  resolvida_em timestamptz
);

-- Uma linha por pessoa e chave (lembretes atualizam a mesma notificação); sem chave, não há conflito.
CREATE UNIQUE INDEX notificacoes_usuario_chave_idx ON public.notificacoes (usuario_id, chave_agrupamento);
CREATE INDEX notificacoes_caixa_idx ON public.notificacoes (usuario_id, resolvida_em, lida_em, criada_em DESC);
CREATE INDEX notificacoes_nc_idx ON public.notificacoes (nc_id);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notificacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notificacoes TO service_role;
REVOKE ALL ON SEQUENCE public.notificacoes_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.notificacoes_id_seq TO service_role;

-- ═══ Auxiliares ═══

CREATE OR REPLACE FUNCTION public.usuarios_qualidade()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT id FROM public.usuarios WHERE ativo AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario);
$$;

-- Liderança do colaborador (R7): supervisor direto ou, com p_cadeia (NC crítica), toda a cadeia de
-- supervisores acima. Mesma noção de liderança de nc_lidera_colaborador: só papel supervisor, ativo.
CREATE OR REPLACE FUNCTION public.lideranca_de(p_colaborador_id uuid, p_cadeia boolean)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  WITH RECURSIVE acima(id, nivel) AS (
    SELECT u.supervisor_id, 1 FROM public.usuarios AS u
     WHERE u.id = p_colaborador_id AND u.supervisor_id IS NOT NULL
    UNION ALL
    SELECT u.supervisor_id, acima.nivel + 1 FROM acima
      JOIN public.usuarios AS u ON u.id = acima.id
     WHERE p_cadeia AND u.papel = 'supervisor'::public.papel_usuario AND u.supervisor_id IS NOT NULL AND acima.nivel < 20
  )
  SELECT DISTINCT acima.id FROM acima
    JOIN public.usuarios AS u ON u.id = acima.id AND u.ativo AND u.papel = 'supervisor'::public.papel_usuario
   WHERE acima.id IS DISTINCT FROM p_colaborador_id;
$$;

-- Próximo dia útil (segunda a sexta) depois de p_data.
CREATE OR REPLACE FUNCTION public.proximo_dia_util(p_data date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT p_data + CASE pg_catalog.date_part('isodow', p_data)::int WHEN 5 THEN 3 WHEN 6 THEN 2 ELSE 1 END;
$$;

-- R4: resolve as pendências da NC que acabaram (chave_agrupamento com o prefixo informado).
CREATE OR REPLACE FUNCTION public.resolver_pendencias(p_nc_id bigint, p_prefixo text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_total integer;
BEGIN
  UPDATE public.notificacoes
     SET resolvida_em = pg_catalog.now(), atualizada_em = pg_catalog.now()
   WHERE chave_agrupamento = p_prefixo || ':' || p_nc_id AND resolvida_em IS NULL;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

-- ═══ Função central: matriz evento × destinatário com R1–R7 ═══

CREATE OR REPLACE FUNCTION public.notificar_evento(p_evento text, p_nc_id bigint, p_autor_id uuid, p_extra jsonb DEFAULT '{}'::jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_nome text;
  v_link text;
  v_lideres uuid[] := '{}';
  v_qualidade uuid[];
  v_fb record;
  v_prazo text;
  v_cand jsonb := '[]'::jsonb;
  v_medida public.medidas_disciplinares%ROWTYPE;
  v_rotulo_medida text;
  v_total integer := 0;
  v_pessoa uuid;
BEGIN
  IF p_nc_id IS NOT NULL THEN
    SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id;
    IF NOT FOUND THEN RETURN 0; END IF;
    v_nome := coalesce(nullif(v_nc.colaborador, ''), 'o colaborador');
    v_link := '/nc/' || p_nc_id;
    IF v_nc.colaborador_id IS NOT NULL THEN
      SELECT coalesce(array_agg(l), '{}') INTO v_lideres FROM public.lideranca_de(v_nc.colaborador_id, v_nc.critica) AS l;
    END IF;
  END IF;
  -- R2/R6: a versão "Qualidade" nunca vai para o acusado.
  SELECT coalesce(array_agg(q), '{}') INTO v_qualidade FROM public.usuarios_qualidade() AS q
   WHERE q IS DISTINCT FROM v_nc.colaborador_id;

  IF p_evento IN ('feedback_aplicado', 'nao_respondida', 'lembrete_aceite', 'prazo_acao') THEN
    SELECT f.id, f.prazo_aceite, f.acao_combinada, f.prazo_acao, f.responsavel_acao_id INTO v_fb
      FROM public.nc_feedbacks AS f WHERE f.nc_id = p_nc_id ORDER BY f.versao DESC LIMIT 1;
    v_prazo := pg_catalog.to_char(v_fb.prazo_aceite AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
  END IF;

  -- Prioridade (R3): 1 acusado, 2 responsável pela ação, 3 líder, 4 quem abriu / solicitante, 5 Qualidade.
  IF p_evento = 'nc_aberta' THEN
    -- D10/D16: Qualidade, exceto quem abriu e o acusado. Quem abriu só tem a confirmação na tela.
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5,
      't', 'Nova NC #' || p_nc_id || ' para avaliar', 'm', 'NC aberta para ' || v_nome || '. Avalie se ela procede.',
      'chave', 'avaliar:' || p_nc_id)), '[]') INTO v_cand FROM unnest(v_qualidade) AS q;

  ELSIF p_evento = 'nc_validada' THEN
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5,
      't', 'NC #' || p_nc_id || ' validada', 'm', 'A NC de ' || v_nome || ' foi validada e aguarda feedback.',
      'chave', 'feedback:' || p_nc_id)), '[]') INTO v_cand FROM unnest(v_qualidade) AS q;
    v_cand := v_cand || jsonb_build_object('u', v_nc.colaborador_id, 'papel', 'acusado', 'p', 1,
      't', 'NC #' || p_nc_id || ' validada contra você', 'm', 'A Qualidade validou a NC. Você receberá o feedback em seguida.');
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider', 'p', 3,
      't', 'NC #' || p_nc_id || ' validada na sua equipe', 'm', 'NC validada contra ' || v_nome || ', da sua equipe.')), '[]')
      INTO v_cand FROM unnest(v_lideres) AS l;
    v_cand := v_cand || jsonb_build_object('u', v_nc.aberto_por, 'papel', 'autor', 'p', 4,
      't', 'Sua NC #' || p_nc_id || ' foi aprovada', 'm', 'A Qualidade validou a NC que você abriu.');

  ELSIF p_evento = 'nc_invalidada' THEN
    v_cand := v_cand || jsonb_build_object('u', v_nc.aberto_por, 'papel', 'autor', 'p', 4,
      't', 'Sua NC #' || p_nc_id || ' foi reprovada', 'm', 'Motivo: ' || coalesce(v_nc.motivo_invalidacao, 'não informado') || '.');

  ELSIF p_evento = 'feedback_aplicado' THEN
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5,
      't', 'Feedback registrado na NC #' || p_nc_id, 'm', v_nome || ' tem até ' || v_prazo || ' para registrar o aceite.')), '[]')
      INTO v_cand FROM unnest(v_qualidade) AS q;
    v_cand := v_cand || jsonb_build_object('u', v_nc.colaborador_id, 'papel', 'acusado', 'p', 1, 'nivel', 'normal',
      't', 'NC #' || p_nc_id || ' precisa do seu aceite', 'm', 'Leia o feedback e registre o aceite até ' || v_prazo || '.',
      'chave', 'aceite:' || p_nc_id);
    -- R5: o responsável pela ação só é avisado se puder abrir a NC.
    IF v_fb.responsavel_acao_id IS NOT NULL AND (
         v_fb.responsavel_acao_id = ANY (v_qualidade) OR v_fb.responsavel_acao_id = v_nc.aberto_por
         OR public.nc_lidera_colaborador(v_fb.responsavel_acao_id, v_nc.colaborador_id)) THEN
      v_cand := v_cand || jsonb_build_object('u', v_fb.responsavel_acao_id, 'papel', 'responsavel_acao', 'p', 2,
        't', 'Você é responsável por uma ação (NC #' || p_nc_id || ')',
        'm', 'Ação: ' || left(v_fb.acao_combinada, 300) || '. Prazo: ' || pg_catalog.to_char(v_fb.prazo_acao, 'DD/MM/YYYY') || '.');
    END IF;
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider', 'p', 3, 'nivel', 'normal',
      't', v_nome || ' precisa dar o aceite (NC #' || p_nc_id || ')', 'm', 'Prazo do aceite: ' || v_prazo || '.',
      'chave', 'aceite:' || p_nc_id)), '[]') INTO v_cand FROM unnest(v_lideres) AS l;

  ELSIF p_evento = 'lembrete_aceite' THEN
    -- p_extra.nivel: 'atencao' (só acusado) ou 'urgente' (acusado e líder).
    v_cand := v_cand || jsonb_build_object('u', v_nc.colaborador_id, 'papel', 'acusado', 'p', 1, 'nivel', p_extra->>'nivel',
      't', CASE WHEN p_extra->>'nivel' = 'urgente' THEN 'Aceite da NC #' || p_nc_id || ' vence em breve' ELSE 'Lembrete: aceite da NC #' || p_nc_id END,
      'm', 'Registre o aceite até ' || v_prazo || '.', 'chave', 'aceite:' || p_nc_id);
    IF p_extra->>'nivel' = 'urgente' THEN
      SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider', 'p', 3, 'nivel', 'urgente',
        't', 'Aceite de ' || v_nome || ' vence em breve (NC #' || p_nc_id || ')', 'm', 'Prazo do aceite: ' || v_prazo || '.',
        'chave', 'aceite:' || p_nc_id)), '[]') INTO v_cand FROM unnest(v_lideres) AS l;
    END IF;

  ELSIF p_evento = 'nao_respondida' THEN
    -- D9/D12: acusado e líder, nível crítica; a Qualidade não é avisada.
    v_cand := v_cand || jsonb_build_object('u', v_nc.colaborador_id, 'papel', 'acusado', 'p', 1, 'nivel', 'critica',
      't', 'NC #' || p_nc_id || ' não respondida no prazo', 'm', 'O prazo venceu em ' || v_prazo || '. O aceite ainda pode ser registrado, fora do prazo.',
      'chave', 'aceite:' || p_nc_id);
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider', 'p', 3, 'nivel', 'critica',
      't', v_nome || ' não respondeu a NC #' || p_nc_id, 'm', 'O prazo do aceite venceu em ' || v_prazo || '.',
      'chave', 'aceite:' || p_nc_id)), '[]') INTO v_cand FROM unnest(v_lideres) AS l;

  ELSIF p_evento = 'aceite_registrado' THEN
    PERFORM public.resolver_pendencias(p_nc_id, 'aceite');
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5,
      't', 'Aceite registrado na NC #' || p_nc_id,
      'm', v_nome || ' registrou o aceite' || CASE WHEN v_nc.aceito_fora_prazo THEN ' fora do prazo.' ELSE '.' END)), '[]')
      INTO v_cand FROM unnest(v_qualidade) AS q;

  ELSIF p_evento = 'prazo_acao' THEN
    IF v_fb.responsavel_acao_id IS NOT NULL AND (
         v_fb.responsavel_acao_id IN (v_nc.colaborador_id, v_nc.aberto_por) OR v_fb.responsavel_acao_id = ANY (v_qualidade)
         OR public.nc_lidera_colaborador(v_fb.responsavel_acao_id, v_nc.colaborador_id)) THEN
      v_cand := v_cand || jsonb_build_object('u', v_fb.responsavel_acao_id, 'papel', 'responsavel_acao', 'p', 2, 'nivel', 'atencao',
        't', 'Prazo da ação vence em ' || pg_catalog.to_char(v_fb.prazo_acao, 'DD/MM') || ' (NC #' || p_nc_id || ')',
        'm', 'Ação: ' || left(v_fb.acao_combinada, 300) || '.', 'chave', 'prazo_acao:' || v_fb.id);
    END IF;

  ELSIF p_evento = 'nc_critica' THEN
    v_cand := v_cand || jsonb_build_object('u', v_nc.colaborador_id, 'papel', 'acusado', 'p', 1,
      't', 'NC #' || p_nc_id || ' marcada como crítica', 'm', 'Foi aberto um plano de ação para esta NC.');
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider', 'p', 3,
      't', 'NC crítica na sua equipe (NC #' || p_nc_id || ')', 'm', 'A NC de ' || v_nome || ' é crítica e tem plano de ação aberto.')), '[]')
      INTO v_cand FROM unnest(v_lideres) AS l;

  ELSIF p_evento = 'plano_atualizado' THEN
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5,
      't', 'Plano de ação atualizado (NC #' || p_nc_id || ')', 'm', left(coalesce(p_extra->>'texto', 'Novo registro no plano.'), 300))), '[]')
      INTO v_cand FROM unnest(v_qualidade) AS q;
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider', 'p', 3,
      't', 'Plano de ação atualizado (NC #' || p_nc_id || ')', 'm', left(coalesce(p_extra->>'texto', 'Novo registro no plano.'), 300))), '[]')
      INTO v_cand FROM unnest(v_lideres) AS l;

  ELSIF p_evento = 'plano_concluido' THEN
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5,
      't', 'Plano de ação concluído (NC #' || p_nc_id || ')', 'm', 'A eficácia foi verificada e a NC foi concluída.')), '[]')
      INTO v_cand FROM unnest(v_qualidade) AS q;
    v_cand := v_cand || jsonb_build_object('u', v_nc.colaborador_id, 'papel', 'acusado', 'p', 1,
      't', 'Plano de ação concluído (NC #' || p_nc_id || ')', 'm', 'A eficácia foi verificada e a NC foi concluída.');
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider', 'p', 3,
      't', 'Plano de ação concluído (NC #' || p_nc_id || ')', 'm', 'O plano da NC de ' || v_nome || ' foi concluído.')), '[]')
      INTO v_cand FROM unnest(v_lideres) AS l;

  ELSIF p_evento IN ('medida_sugerida', 'medida_decidida', 'medida_aplicada') THEN
    SELECT * INTO v_medida FROM public.medidas_disciplinares WHERE id = (p_extra->>'medida_id')::bigint;
    IF NOT FOUND THEN RETURN 0; END IF;
    v_rotulo_medida := CASE v_medida.tipo WHEN 'advertencia' THEN 'advertência' WHEN 'suspensao' THEN 'suspensão' ELSE 'avaliação de justa causa' END;
    IF p_evento = 'medida_sugerida' THEN
      SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5, 'link', '/medidas',
        't', 'Medida disciplinar sugerida', 'm', 'Sugestão de ' || v_rotulo_medida || ' para ' || v_nome || ' (' || v_medida.ocorrencia_gatilho || 'ª ocorrência).',
        'chave', 'medida:' || v_medida.id)), '[]') INTO v_cand FROM unnest(v_qualidade) AS q;
    ELSIF p_evento = 'medida_decidida' THEN
      UPDATE public.notificacoes SET resolvida_em = pg_catalog.now(), atualizada_em = pg_catalog.now()
       WHERE chave_agrupamento = 'medida:' || v_medida.id AND resolvida_em IS NULL;
      SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5, 'link', '/medidas',
        't', 'Medida ' || CASE WHEN v_medida.status = 'aprovada' THEN 'aprovada' ELSE 'reprovada' END,
        'm', initcap(v_rotulo_medida) || ' para ' || v_nome || CASE WHEN v_medida.status = 'aprovada' THEN ' aprovada; falta registrar a aplicação.' ELSE ' reprovada.' END,
        'chave', CASE WHEN v_medida.status = 'aprovada' THEN 'medida_aplicar:' || v_medida.id END)), '[]')
        INTO v_cand FROM unnest(v_qualidade) AS q;
    ELSE
      UPDATE public.notificacoes SET resolvida_em = pg_catalog.now(), atualizada_em = pg_catalog.now()
       WHERE chave_agrupamento = 'medida_aplicar:' || v_medida.id AND resolvida_em IS NULL;
      SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5, 'link', '/medidas',
        't', 'Medida aplicada', 'm', initcap(v_rotulo_medida) || ' aplicada a ' || v_nome || '.')), '[]')
        INTO v_cand FROM unnest(v_qualidade) AS q;
      v_cand := v_cand || jsonb_build_object('u', v_nc.colaborador_id, 'papel', 'acusado', 'p', 1,
        't', 'Você recebeu uma medida disciplinar', 'm', 'Medida: ' || v_rotulo_medida || ' (NC #' || p_nc_id || ').');
      SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider', 'p', 3,
        't', v_nome || ' recebeu uma medida', 'm', 'Medida: ' || v_rotulo_medida || ' (NC #' || p_nc_id || ').')), '[]')
        INTO v_cand FROM unnest(v_lideres) AS l;
    END IF;

  ELSIF p_evento = 'causa_solicitada' THEN
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5, 'link', '/causas',
      't', 'Nova solicitação de causa', 'm', 'Causa solicitada: ' || left(p_extra->>'descricao', 200) || '.',
      'chave', 'causa:' || (p_extra->>'solicitacao_id'))), '[]') INTO v_cand FROM unnest(v_qualidade) AS q;

  ELSIF p_evento = 'causa_decidida' THEN
    UPDATE public.notificacoes SET resolvida_em = pg_catalog.now(), atualizada_em = pg_catalog.now()
     WHERE chave_agrupamento = 'causa:' || (p_extra->>'solicitacao_id') AND resolvida_em IS NULL;
    v_cand := v_cand || jsonb_build_object('u', (p_extra->>'solicitante')::uuid, 'papel', 'solicitante', 'p', 4, 'link', '/abrir-nc',
      't', CASE WHEN p_extra->>'status' = 'rejeitada' THEN 'Solicitação de causa rejeitada' ELSE 'Solicitação de causa aprovada' END,
      'm', 'Causa "' || left(p_extra->>'descricao', 200) || '"' ||
           CASE WHEN p_extra->>'status' = 'rejeitada' THEN ' rejeitada. Motivo: ' || coalesce(p_extra->>'observacao', 'não informado') || '.'
                ELSE ' disponível no catálogo.' END);

  ELSE
    RETURN 0;
  END IF;

  -- Pendências encerradas por esta transição (R4).
  IF p_evento IN ('nc_validada', 'nc_invalidada') THEN PERFORM public.resolver_pendencias(p_nc_id, 'avaliar'); END IF;
  IF p_evento = 'feedback_aplicado' THEN PERFORM public.resolver_pendencias(p_nc_id, 'feedback'); END IF;

  -- R1 (sem o executor), R3 (uma por pessoa, a mais relevante), usuário ativo; lembretes atualizam a mesma linha.
  WITH candidatos AS (
    SELECT DISTINCT ON (c.u) c.*
      FROM jsonb_to_recordset(v_cand) AS c(u uuid, papel text, p int, nivel text, t text, m text, chave text, link text)
      JOIN public.usuarios AS usu ON usu.id = c.u AND usu.ativo
     WHERE c.u IS NOT NULL AND c.u IS DISTINCT FROM p_autor_id
     ORDER BY c.u, c.p
  ), gravadas AS (
    INSERT INTO public.notificacoes AS n (usuario_id, evento, papel_destinatario, nivel, nc_id, medida_id, titulo, mensagem, link, chave_agrupamento)
    SELECT c.u, p_evento, c.papel, coalesce(c.nivel, 'normal'), p_nc_id, nullif(p_extra->>'medida_id', '')::bigint,
           left(c.t, 200), left(c.m, 1000), coalesce(c.link, v_link), c.chave
      FROM candidatos AS c
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

-- ═══ Triggers: cada evento nasce na mesma transação da RPC que o grava ═══

CREATE OR REPLACE FUNCTION public.notificar_historico_nc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_evento text;
BEGIN
  IF NEW.status_anterior IS NOT DISTINCT FROM NEW.status_novo THEN RETURN NEW; END IF;
  v_evento := CASE
    WHEN NEW.status_anterior IS NULL AND NEW.status_novo = 'aberta' THEN 'nc_aberta'
    WHEN NEW.status_anterior = 'aberta' AND NEW.status_novo = 'aguardando_feedback' THEN 'nc_validada'
    WHEN NEW.status_anterior = 'aberta' AND NEW.status_novo = 'invalidada' THEN 'nc_invalidada'
    WHEN NEW.status_novo = 'aguardando_aceite' THEN 'feedback_aplicado'
    WHEN NEW.status_anterior IN ('aguardando_aceite', 'nao_respondida') AND NEW.status_novo IN ('concluida', 'em_plano_acao') THEN 'aceite_registrado'
    WHEN NEW.status_anterior = 'aguardando_aceite' AND NEW.status_novo = 'nao_respondida' THEN 'nao_respondida'
  END;
  IF v_evento IS NOT NULL THEN PERFORM public.notificar_evento(v_evento, NEW.nc_id, NEW.usuario_id, '{}'::jsonb); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notificar_historico_nc AFTER INSERT ON public.historico_nc
  FOR EACH ROW EXECUTE FUNCTION public.notificar_historico_nc();

CREATE OR REPLACE FUNCTION public.notificar_nc_critica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.notificar_evento('nc_critica', NEW.id, NEW.critica_marcada_por, '{}'::jsonb);
  RETURN NEW;
END;
$$;
CREATE TRIGGER notificar_nc_critica AFTER UPDATE OF critica ON public.nao_conformidades
  FOR EACH ROW WHEN (NEW.critica AND NOT OLD.critica) EXECUTE FUNCTION public.notificar_nc_critica();

CREATE OR REPLACE FUNCTION public.notificar_plano_acompanhamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_nc_id bigint;
BEGIN
  -- D20: registros de acompanhamento e alterações do plano; eventos de crítica/conclusão têm aviso próprio.
  IF NEW.tipo = 'registro' OR (NEW.tipo = 'evento' AND NEW.texto LIKE 'Plano atualizado (%') THEN
    SELECT nc_id INTO v_nc_id FROM public.planos_acao WHERE id = NEW.plano_id;
    PERFORM public.notificar_evento('plano_atualizado', v_nc_id, NEW.usuario_id, jsonb_build_object('texto', NEW.texto));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notificar_plano_acompanhamento AFTER INSERT ON public.plano_acao_acompanhamentos
  FOR EACH ROW EXECUTE FUNCTION public.notificar_plano_acompanhamento();

CREATE OR REPLACE FUNCTION public.notificar_plano_concluido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.notificar_evento('plano_concluido', NEW.nc_id, NEW.concluido_por, '{}'::jsonb);
  RETURN NEW;
END;
$$;
CREATE TRIGGER notificar_plano_concluido AFTER UPDATE OF status ON public.planos_acao
  FOR EACH ROW WHEN (NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido')
  EXECUTE FUNCTION public.notificar_plano_concluido();

CREATE OR REPLACE FUNCTION public.notificar_medida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'sugerida' THEN
    -- Sugestão é do sistema (regra de reincidência): toda a Qualidade sem conflito é avisada para decidir.
    PERFORM public.notificar_evento('medida_sugerida', NEW.nc_id, NULL, jsonb_build_object('medida_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('aprovada', 'reprovada') AND OLD.status = 'sugerida' THEN
    PERFORM public.notificar_evento('medida_decidida', NEW.nc_id, NEW.decidida_por, jsonb_build_object('medida_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'aplicada' AND OLD.status IS DISTINCT FROM 'aplicada' THEN
    PERFORM public.notificar_evento('medida_aplicada', NEW.nc_id, NEW.aplicada_por, jsonb_build_object('medida_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notificar_medida AFTER INSERT OR UPDATE OF status ON public.medidas_disciplinares
  FOR EACH ROW EXECUTE FUNCTION public.notificar_medida();

CREATE OR REPLACE FUNCTION public.notificar_solicitacao_causa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pendente' THEN
    PERFORM public.notificar_evento('causa_solicitada', NULL, NEW.solicitado_por,
      jsonb_build_object('solicitacao_id', NEW.id, 'descricao', NEW.descricao));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pendente' AND NEW.status <> 'pendente' THEN
    PERFORM public.notificar_evento('causa_decidida', NULL, NEW.decidido_por,
      jsonb_build_object('solicitacao_id', NEW.id, 'descricao', NEW.descricao, 'status', NEW.status,
                         'observacao', NEW.observacao_decisao, 'solicitante', NEW.solicitado_por));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notificar_solicitacao_causa AFTER INSERT OR UPDATE OF status ON public.solicitacoes_causa
  FOR EACH ROW EXECUTE FUNCTION public.notificar_solicitacao_causa();

-- ═══ Lembretes (5.4): só de segunda a sexta, 9h–18h; contas em horas de expediente (D18, D22) ═══

CREATE OR REPLACE FUNCTION public.lembretes_notificacoes_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_agora timestamptz := pg_catalog.now();
  v_local timestamp := pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo';
  v_hoje date := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_item record;
  v_atencao integer := 0;
  v_urgente integer := 0;
  v_prazo_acao integer := 0;
BEGIN
  IF pg_catalog.date_part('isodow', v_local) IN (6, 7) OR v_local::time < time '09:00' OR v_local::time >= time '18:00' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'fora_do_expediente', true);
  END IF;

  FOR v_item IN
    SELECT nc.id, nc.colaborador_id, f.prazo_aceite, f.registrado_em,
           (SELECT n.nivel FROM public.notificacoes AS n
             WHERE n.usuario_id = nc.colaborador_id AND n.chave_agrupamento = 'aceite:' || nc.id) AS nivel_atual
      FROM public.nao_conformidades AS nc
      JOIN LATERAL (SELECT * FROM public.nc_feedbacks AS fb WHERE fb.nc_id = nc.id ORDER BY fb.versao DESC LIMIT 1) AS f ON true
     WHERE nc.status = 'aguardando_aceite' AND f.prazo_aceite > v_agora
  LOOP
    -- Urgente: faltam 4 horas de expediente ou menos para o prazo.
    IF public.somar_horas_expediente(v_agora, 4) >= v_item.prazo_aceite
       AND coalesce(v_item.nivel_atual, 'normal') NOT IN ('urgente', 'critica') THEN
      PERFORM public.notificar_evento('lembrete_aceite', v_item.id, NULL, '{"nivel": "urgente"}'::jsonb);
      v_urgente := v_urgente + 1;
    -- Atenção: a partir das 9h do dia útil seguinte ao envio do feedback.
    ELSIF v_hoje > (v_item.registrado_em AT TIME ZONE 'America/Sao_Paulo')::date
       AND coalesce(v_item.nivel_atual, 'normal') = 'normal' THEN
      PERFORM public.notificar_evento('lembrete_aceite', v_item.id, NULL, '{"nivel": "atencao"}'::jsonb);
      v_atencao := v_atencao + 1;
    END IF;
  END LOOP;

  -- Prazo da ação combinada: um aviso ao responsável no dia útil anterior (uma vez por feedback).
  FOR v_item IN
    SELECT f.nc_id, f.id AS feedback_id, f.responsavel_acao_id
      FROM public.nc_feedbacks AS f
      JOIN public.nao_conformidades AS nc ON nc.id = f.nc_id
     WHERE NOT f.legado AND f.prazo_acao IS NOT NULL
       AND f.prazo_acao >= v_hoje AND f.prazo_acao <= public.proximo_dia_util(v_hoje)
       AND f.versao = (SELECT max(f2.versao) FROM public.nc_feedbacks AS f2 WHERE f2.nc_id = f.nc_id)
       AND NOT EXISTS (SELECT 1 FROM public.notificacoes AS n
                        WHERE n.usuario_id = f.responsavel_acao_id AND n.chave_agrupamento = 'prazo_acao:' || f.id)
  LOOP
    PERFORM public.notificar_evento('prazo_acao', v_item.nc_id, NULL, '{}'::jsonb);
    v_prazo_acao := v_prazo_acao + 1;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'atencao', v_atencao, 'urgente', v_urgente, 'prazo_acao', v_prazo_acao);
END;
$$;

SELECT cron.schedule('sgnc-lembretes-notificacoes', '*/15 * * * *', $$SELECT public.lembretes_notificacoes_v1()$$);

-- ═══ Permissões: só o servidor (service_role) e os triggers executam ═══

REVOKE ALL ON FUNCTION public.usuarios_qualidade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lideranca_de(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.proximo_dia_util(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolver_pendencias(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_evento(text, bigint, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lembretes_notificacoes_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_historico_nc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_nc_critica() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_plano_acompanhamento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_plano_concluido() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_medida() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_solicitacao_causa() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_evento(text, bigint, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_pendencias(bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lembretes_notificacoes_v1() TO service_role;
