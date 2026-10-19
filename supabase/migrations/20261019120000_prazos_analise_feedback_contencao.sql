-- Fase 3 do processo de gestão de NCs (docs/plano-processo-gestao-nc.md, decisões de 18 e 19/10):
-- prazos de análise de causa, de feedback e de contenção.
--
--   * Análise de causa vira etapa própria: a Qualidade registra a causa raiz antes do feedback.
--     Prazo: 18 h de expediente (2 dias úteis) a partir da validação; NC crítica: fim do dia útil
--     da marcação.
--   * Feedback: 45 h de expediente (5 dias úteis) a partir da validação; NC crítica: 9 h de
--     expediente (1 dia útil) a partir da marcação. O feedback de NC com prazo de análise exige
--     a análise registrada; a causa raiz do feedback vem dela.
--   * Contenção (só NC crítica): 24 h corridas a partir da marcação. Responsável inicial: quem
--     marcou; quem marcou (ou outra pessoa da Qualidade sem conflito) pode designar outra pessoa.
--   * Responsável pela etapa: análise e feedback, quem validou (responsavel_id); contenção, o
--     responsável designado. Lembrete "urgente" a 4 h do prazo; vencido, aviso "crítica" ao
--     responsável e ao líder direto dele. Só de segunda a sexta, 9h–18h (job próprio).
--   * NCs validadas antes desta migração ficam sem prazo (nada vence retroativamente).
-- Migração aditiva: nenhuma RPC existente é alterada; registrar_feedback_v4 continua disponível.

-- ═══ Colunas ═══

ALTER TABLE public.nao_conformidades
  ADD COLUMN prazo_analise timestamptz,
  ADD COLUMN prazo_feedback timestamptz,
  ADD COLUMN analise_causa text CHECK (analise_causa IS NULL OR length(btrim(analise_causa)) BETWEEN 1 AND 4000),
  ADD COLUMN analise_registrada_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN analise_registrada_em timestamptz,
  ADD COLUMN prazo_contencao timestamptz,
  ADD COLUMN contencao_responsavel_id uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN contencao_designada_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN contencao_designada_em timestamptz,
  ADD COLUMN contencao_descricao text CHECK (contencao_descricao IS NULL OR length(btrim(contencao_descricao)) BETWEEN 10 AND 4000),
  ADD COLUMN contencao_registrada_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN contencao_registrada_em timestamptz;

CREATE INDEX nao_conformidades_contencao_resp_idx ON public.nao_conformidades (contencao_responsavel_id)
  WHERE contencao_responsavel_id IS NOT NULL;

-- ═══ Auxiliar: fim do dia útil (18h) do instante informado ═══
-- Antes das 18h de um dia útil: 18h do mesmo dia. Depois das 18h ou no fim de semana: 18h do próximo dia útil.

CREATE OR REPLACE FUNCTION public.fim_do_dia_util(p_instante timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $$
DECLARE
  v_local timestamp := p_instante AT TIME ZONE 'America/Sao_Paulo';
  v_dia date := v_local::date;
BEGIN
  IF p_instante IS NULL THEN RETURN NULL; END IF;
  IF pg_catalog.date_part('isodow', v_local) IN (6, 7) OR v_local::time >= time '18:00' THEN
    v_dia := public.proximo_dia_util(v_dia);
  END IF;
  RETURN (v_dia + time '18:00') AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

-- ═══ Prazos calculados na mesma transação da validação e da marcação de crítica ═══

CREATE OR REPLACE FUNCTION public.definir_prazos_etapas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  -- Validação: abre análise e feedback (prazos normais).
  IF OLD.validado_em IS NULL AND NEW.validado_em IS NOT NULL
     AND NEW.status = 'aguardando_feedback'::public.status_nc THEN
    NEW.prazo_analise := public.somar_horas_expediente(NEW.validado_em, 18);
    NEW.prazo_feedback := public.somar_horas_expediente(NEW.validado_em, 45);
  END IF;

  -- Marcação de crítica: prazos curtos para as etapas ainda abertas e contenção em 24 h corridas.
  IF NEW.critica AND NOT OLD.critica THEN
    IF NEW.feedback_aplicado_em IS NULL THEN
      IF NEW.analise_registrada_em IS NULL THEN
        NEW.prazo_analise := public.fim_do_dia_util(NEW.critica_marcada_em);
      END IF;
      NEW.prazo_feedback := public.somar_horas_expediente(NEW.critica_marcada_em, 9);
    END IF;
    IF NEW.contencao_registrada_em IS NULL THEN
      NEW.prazo_contencao := NEW.critica_marcada_em + interval '24 hours';
      NEW.contencao_responsavel_id := NEW.critica_marcada_por;
      NEW.contencao_designada_por := NEW.critica_marcada_por;
      NEW.contencao_designada_em := NEW.critica_marcada_em;
    END IF;
  END IF;

  -- Criticidade removida: volta aos prazos normais (só NCs validadas com prazo) e encerra a contenção pendente.
  IF OLD.critica AND NOT NEW.critica THEN
    IF NEW.feedback_aplicado_em IS NULL AND OLD.prazo_feedback IS NOT NULL AND NEW.validado_em IS NOT NULL THEN
      IF NEW.analise_registrada_em IS NULL THEN
        NEW.prazo_analise := public.somar_horas_expediente(NEW.validado_em, 18);
      END IF;
      NEW.prazo_feedback := public.somar_horas_expediente(NEW.validado_em, 45);
    END IF;
    IF NEW.contencao_registrada_em IS NULL THEN
      NEW.prazo_contencao := NULL;
      NEW.contencao_responsavel_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER definir_prazos_etapas BEFORE UPDATE OF validado_em, critica ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.definir_prazos_etapas();

-- ═══ Notificações das etapas com prazo ═══
-- Mesma tabela e mesmas regras (R1 sem o executor, uma linha por pessoa e chave, usuário ativo).
-- p_tipo: 'designada' (contenção atribuída), 'urgente' (faltam 4 h) ou 'vencido' (responsável + líder direto).

CREATE OR REPLACE FUNCTION public.notificar_prazo_etapa(p_nc_id bigint, p_etapa text, p_tipo text, p_autor_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_resp uuid;
  v_prazo timestamptz;
  v_rotulo text;
  v_quando text;
  v_papel text;
  v_nivel text;
  v_cand jsonb := '[]'::jsonb;
  v_total integer := 0;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF p_etapa = 'analise' THEN
    v_resp := v_nc.responsavel_id; v_prazo := v_nc.prazo_analise; v_rotulo := 'Análise de causa'; v_papel := 'qualidade';
  ELSIF p_etapa = 'feedback' THEN
    v_resp := v_nc.responsavel_id; v_prazo := v_nc.prazo_feedback; v_rotulo := 'Feedback'; v_papel := 'qualidade';
  ELSIF p_etapa = 'contencao' THEN
    v_resp := v_nc.contencao_responsavel_id; v_prazo := v_nc.prazo_contencao; v_rotulo := 'Contenção'; v_papel := 'responsavel_acao';
  ELSE
    RETURN 0;
  END IF;
  IF v_resp IS NULL OR v_prazo IS NULL THEN RETURN 0; END IF;
  v_quando := pg_catalog.to_char(v_prazo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
  v_nivel := CASE p_tipo WHEN 'vencido' THEN 'critica' WHEN 'urgente' THEN 'urgente' ELSE 'normal' END;

  IF p_tipo = 'designada' THEN
    v_cand := v_cand || jsonb_build_object('u', v_resp, 'papel', v_papel,
      't', 'Você é responsável pela contenção (NC #' || p_nc_id || ')',
      'm', 'Registre a contenção da NC crítica até ' || v_quando || '.');
  ELSIF p_tipo = 'urgente' THEN
    v_cand := v_cand || jsonb_build_object('u', v_resp, 'papel', v_papel,
      't', v_rotulo || ' da NC #' || p_nc_id || ' vence em breve', 'm', 'Prazo: ' || v_quando || '.');
  ELSIF p_tipo = 'vencido' THEN
    v_cand := v_cand || jsonb_build_object('u', v_resp, 'papel', v_papel,
      't', v_rotulo || ' da NC #' || p_nc_id || ' com prazo vencido', 'm', 'O prazo venceu em ' || v_quando || '.');
    -- Decisão de 18/10: vencido o prazo, o líder direto de quem era responsável pela etapa é acionado.
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', l, 'papel', 'lider',
      't', v_rotulo || ' com prazo vencido (NC #' || p_nc_id || ')',
      'm', 'A etapa "' || v_rotulo || '" sob responsabilidade de '
           || coalesce((SELECT nome FROM public.usuarios WHERE id = v_resp), 'um liderado') || ' venceu em ' || v_quando || '.')), '[]')
      INTO v_cand FROM public.lideranca_de(v_resp, false) AS l;
  ELSE
    RETURN 0;
  END IF;

  WITH candidatos AS (
    SELECT DISTINCT ON (c.u) c.*
      FROM jsonb_to_recordset(v_cand) AS c(u uuid, papel text, t text, m text)
      JOIN public.usuarios AS usu ON usu.id = c.u AND usu.ativo
     WHERE c.u IS NOT NULL AND c.u IS DISTINCT FROM p_autor_id
     ORDER BY c.u, CASE c.papel WHEN 'lider' THEN 2 ELSE 1 END
  ), gravadas AS (
    INSERT INTO public.notificacoes AS n (usuario_id, evento, papel_destinatario, nivel, nc_id, titulo, mensagem, link, chave_agrupamento)
    SELECT c.u, 'prazo_' || p_etapa, c.papel, v_nivel, p_nc_id, left(c.t, 200), left(c.m, 1000), '/nc/' || p_nc_id,
           'prazo_' || p_etapa || ':' || p_nc_id
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

-- Etapas concluídas resolvem os avisos de prazo (R4).
CREATE OR REPLACE FUNCTION public.resolver_prazos_etapas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.analise_registrada_em IS NOT NULL AND OLD.analise_registrada_em IS NULL THEN
    PERFORM public.resolver_pendencias(NEW.id, 'prazo_analise');
  END IF;
  IF NEW.feedback_aplicado_em IS NOT NULL AND OLD.feedback_aplicado_em IS DISTINCT FROM NEW.feedback_aplicado_em THEN
    PERFORM public.resolver_pendencias(NEW.id, 'prazo_analise');
    PERFORM public.resolver_pendencias(NEW.id, 'prazo_feedback');
  END IF;
  IF (NEW.contencao_registrada_em IS NOT NULL AND OLD.contencao_registrada_em IS NULL)
     OR (NEW.prazo_contencao IS NULL AND OLD.prazo_contencao IS NOT NULL) THEN
    PERFORM public.resolver_pendencias(NEW.id, 'prazo_contencao');
  END IF;
  IF NEW.status IN ('invalidada'::public.status_nc) AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.resolver_pendencias(NEW.id, 'prazo_analise');
    PERFORM public.resolver_pendencias(NEW.id, 'prazo_feedback');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER resolver_prazos_etapas AFTER UPDATE ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.resolver_prazos_etapas();

-- Contenção atribuída (na marcação e em cada nova designação): aviso ao responsável.
CREATE OR REPLACE FUNCTION public.notificar_contencao_designada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.contencao_responsavel_id IS NOT NULL AND NEW.contencao_registrada_em IS NULL
     AND NEW.contencao_responsavel_id IS DISTINCT FROM OLD.contencao_responsavel_id THEN
    -- A pendência anterior (de outro responsável) sai antes do novo aviso.
    PERFORM public.resolver_pendencias(NEW.id, 'prazo_contencao');
    PERFORM public.notificar_prazo_etapa(NEW.id, 'contencao', 'designada', NEW.contencao_designada_por);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notificar_contencao_designada AFTER UPDATE OF contencao_responsavel_id ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.notificar_contencao_designada();

-- ═══ RPC: análise de causa ═══

CREATE OR REPLACE FUNCTION public.registrar_analise_causa_v1(p_nc_id bigint, p_usuario_id uuid, p_texto text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_texto text := pg_catalog.btrim(coalesce(p_texto, ''));
  v_agora timestamptz := pg_catalog.now();
  v_fora_prazo boolean;
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
  IF v_nc.status NOT IN ('aguardando_feedback'::public.status_nc, 'aguardando_analise'::public.status_nc) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  IF v_texto = '' OR length(v_texto) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'campo_obrigatorio', 'campo', 'analise_causa');
  END IF;

  v_fora_prazo := v_nc.prazo_analise IS NOT NULL AND v_agora > v_nc.prazo_analise;
  UPDATE public.nao_conformidades
     SET analise_causa = v_texto, analise_registrada_por = p_usuario_id, analise_registrada_em = v_agora
   WHERE id = p_nc_id;

  -- Sem troca de status: a entrada aparece na linha do tempo e não dispara a matriz de transições.
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, v_nc.status,
          CASE WHEN v_nc.analise_registrada_em IS NULL THEN 'Análise de causa registrada' ELSE 'Análise de causa revisada' END
            || CASE WHEN v_fora_prazo THEN ' (fora do prazo)' ELSE '' END,
          v_agora);

  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'fora_do_prazo', v_fora_prazo);
END;
$$;

-- ═══ RPC: feedback v5 (exige a análise quando a NC tem prazo de análise) ═══

CREATE OR REPLACE FUNCTION public.registrar_feedback_v5(
  p_nc_id bigint,
  p_responsavel_id uuid,
  p_causa_raiz text,
  p_acao text,
  p_responsavel_acao_id uuid,
  p_prazo_acao date,
  p_combinado text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_responsavel_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.prazo_analise IS NOT NULL AND v_nc.analise_registrada_em IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'analise_pendente', 'campo', 'causa_raiz');
  END IF;
  -- A causa raiz do feedback é a da análise registrada (quando houver).
  RETURN public.registrar_feedback_v4(p_nc_id, p_responsavel_id, coalesce(v_nc.analise_causa, p_causa_raiz),
                                      p_acao, p_responsavel_acao_id, p_prazo_acao, p_combinado);
END;
$$;

-- ═══ RPC: contenção ═══

CREATE OR REPLACE FUNCTION public.designar_contencao_v1(p_nc_id bigint, p_usuario_id uuid, p_responsavel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_nome text;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  -- Quem marcou a NC como crítica designa; outra pessoa da Qualidade também pode (ex.: ausência).
  IF v_nc.critica_marcada_por IS DISTINCT FROM p_usuario_id AND NOT EXISTS (
       SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo
          AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF NOT v_nc.critica OR v_nc.prazo_contencao IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_critica');
  END IF;
  IF v_nc.contencao_registrada_em IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'contencao_registrada');
  END IF;
  IF p_responsavel_id IS NULL OR p_responsavel_id = v_nc.colaborador_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'responsavel_invalido', 'campo', 'responsavel');
  END IF;
  SELECT nome INTO v_nome FROM public.usuarios WHERE id = p_responsavel_id AND ativo;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'responsavel_invalido', 'campo', 'responsavel');
  END IF;
  IF v_nc.contencao_responsavel_id = p_responsavel_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'sem_alteracao', true);
  END IF;

  UPDATE public.nao_conformidades
     SET contencao_responsavel_id = p_responsavel_id, contencao_designada_por = p_usuario_id, contencao_designada_em = v_agora
   WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, v_nc.status, 'Contenção designada para ' || v_nome, v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_contencao_v1(p_nc_id bigint, p_usuario_id uuid, p_descricao text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_texto text := pg_catalog.btrim(coalesce(p_descricao, ''));
  v_agora timestamptz := pg_catalog.now();
  v_fora_prazo boolean;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.contencao_responsavel_id IS DISTINCT FROM p_usuario_id AND NOT EXISTS (
       SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo
          AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF NOT v_nc.critica OR v_nc.prazo_contencao IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_critica');
  END IF;
  IF v_nc.contencao_registrada_em IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'contencao_registrada');
  END IF;
  IF length(v_texto) < 10 OR length(v_texto) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'campo_obrigatorio', 'campo', 'contencao_descricao');
  END IF;

  v_fora_prazo := v_agora > v_nc.prazo_contencao;
  UPDATE public.nao_conformidades
     SET contencao_descricao = v_texto, contencao_registrada_por = p_usuario_id, contencao_registrada_em = v_agora
   WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, v_nc.status, v_nc.status,
          'Contenção registrada' || CASE WHEN v_fora_prazo THEN ' (fora do prazo)' ELSE '' END, v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'fora_do_prazo', v_fora_prazo);
END;
$$;

-- ═══ Job: lembretes e vencimentos das etapas (só de segunda a sexta, 9h–18h) ═══

CREATE OR REPLACE FUNCTION public.prazos_etapas_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_agora timestamptz := pg_catalog.now();
  v_local timestamp := pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo';
  v_item record;
  v_urgente integer := 0;
  v_vencido integer := 0;
BEGIN
  IF pg_catalog.date_part('isodow', v_local) IN (6, 7) OR v_local::time < time '09:00' OR v_local::time >= time '18:00' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'fora_do_expediente', true);
  END IF;

  FOR v_item IN
    SELECT e.nc_id, e.etapa, e.resp, e.prazo,
           (SELECT n.nivel FROM public.notificacoes AS n
             WHERE n.usuario_id = e.resp AND n.chave_agrupamento = 'prazo_' || e.etapa || ':' || e.nc_id) AS nivel_atual
      FROM (
        SELECT nc.id AS nc_id, 'analise'::text AS etapa, nc.responsavel_id AS resp, nc.prazo_analise AS prazo
          FROM public.nao_conformidades AS nc
         WHERE nc.status IN ('aguardando_feedback', 'aguardando_analise') AND nc.prazo_analise IS NOT NULL
           AND nc.analise_registrada_em IS NULL
        UNION ALL
        SELECT nc.id, 'feedback', nc.responsavel_id, nc.prazo_feedback
          FROM public.nao_conformidades AS nc
         WHERE nc.status IN ('aguardando_feedback', 'aguardando_analise') AND nc.prazo_feedback IS NOT NULL
           AND nc.feedback_aplicado_em IS NULL
        UNION ALL
        SELECT nc.id, 'contencao', nc.contencao_responsavel_id, nc.prazo_contencao
          FROM public.nao_conformidades AS nc
         WHERE nc.critica AND nc.prazo_contencao IS NOT NULL AND nc.contencao_registrada_em IS NULL
           AND nc.status <> 'invalidada'
      ) AS e
     WHERE e.resp IS NOT NULL
  LOOP
    IF v_item.prazo <= v_agora THEN
      IF coalesce(v_item.nivel_atual, '') <> 'critica' THEN
        PERFORM public.notificar_prazo_etapa(v_item.nc_id, v_item.etapa, 'vencido');
        v_vencido := v_vencido + 1;
      END IF;
    -- Urgente: faltam 4 horas (de expediente para análise e feedback; corridas para a contenção).
    ELSIF (CASE WHEN v_item.etapa = 'contencao' THEN v_agora + interval '4 hours'
                ELSE public.somar_horas_expediente(v_agora, 4) END) >= v_item.prazo
          AND coalesce(v_item.nivel_atual, 'normal') NOT IN ('urgente', 'critica') THEN
      PERFORM public.notificar_prazo_etapa(v_item.nc_id, v_item.etapa, 'urgente');
      v_urgente := v_urgente + 1;
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'urgente', v_urgente, 'vencido', v_vencido);
END;
$$;

SELECT cron.schedule('sgnc-prazos-etapas', '*/15 * * * *', $$SELECT public.prazos_etapas_v1()$$);

-- ═══ Permissões: só o servidor (service_role) e os triggers executam ═══

REVOKE ALL ON FUNCTION public.fim_do_dia_util(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.definir_prazos_etapas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_prazo_etapa(bigint, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolver_prazos_etapas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_contencao_designada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_analise_causa_v1(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_feedback_v5(bigint, uuid, text, text, uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.designar_contencao_v1(bigint, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_contencao_v1(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prazos_etapas_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fim_do_dia_util(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_analise_causa_v1(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_feedback_v5(bigint, uuid, text, text, uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.designar_contencao_v1(bigint, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_contencao_v1(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.prazos_etapas_v1() TO service_role;
