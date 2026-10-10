-- Fase 4 do retorno da diretoria: feedback estruturado e aceite com prazo (D3–D6, D8, D9, D11, D14, D22).
--
--   * Feedback com causa raiz, ação combinada, responsável pela ação, prazo da ação e combinado,
--     todos obrigatórios; anexos de evidência opcionais (evidencias.feedback_id).
--   * Prazo de aceite = 18 horas de expediente (segunda a sexta, 9h às 18h, America/Sao_Paulo,
--     sem feriados) a partir do envio; envio fora do expediente começa a contar às 9h do próximo dia útil.
--   * Vencido o prazo, a NC passa para 'nao_respondida' (job), com histórico de autor nulo (sistema).
--   * O aceite continua possível depois disso e fica marcado como fora do prazo.
--   * 'nao_respondida' conta como ocorrência para reincidência.
-- Migração aditiva: nada existente é removido; as RPCs v3 continuam disponíveis.

-- ═══ Expediente ═══

CREATE OR REPLACE FUNCTION public.somar_horas_expediente(p_inicio timestamptz, p_horas integer)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $$
DECLARE
  v_local timestamp := p_inicio AT TIME ZONE 'America/Sao_Paulo';
  v_restante interval := pg_catalog.make_interval(hours => p_horas);
  v_fim_dia timestamp;
BEGIN
  IF p_inicio IS NULL OR p_horas IS NULL OR p_horas < 0 THEN RETURN NULL; END IF;
  LOOP
    -- Sábado e domingo: pula para segunda às 9h.
    IF pg_catalog.date_part('isodow', v_local) IN (6, 7) THEN
      v_local := pg_catalog.date_trunc('day', v_local) + interval '1 day 9 hours';
      CONTINUE;
    END IF;
    -- Antes das 9h: começa às 9h do mesmo dia. Depois das 18h: 9h do dia seguinte.
    IF v_local::time < time '09:00' THEN
      v_local := pg_catalog.date_trunc('day', v_local) + interval '9 hours';
    ELSIF v_local::time >= time '18:00' THEN
      v_local := pg_catalog.date_trunc('day', v_local) + interval '1 day 9 hours';
      CONTINUE;
    END IF;
    v_fim_dia := pg_catalog.date_trunc('day', v_local) + interval '18 hours';
    IF v_local + v_restante <= v_fim_dia THEN
      RETURN (v_local + v_restante) AT TIME ZONE 'America/Sao_Paulo';
    END IF;
    v_restante := v_restante - (v_fim_dia - v_local);
    v_local := pg_catalog.date_trunc('day', v_local) + interval '1 day 9 hours';
  END LOOP;
END;
$$;

-- ═══ Tabelas ═══

CREATE TABLE public.nc_feedbacks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nc_id bigint NOT NULL REFERENCES public.nao_conformidades(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  causa_raiz text NOT NULL CHECK (length(btrim(causa_raiz)) BETWEEN 1 AND 4000),
  acao_combinada text NOT NULL CHECK (length(btrim(acao_combinada)) BETWEEN 1 AND 4000),
  responsavel_acao_id uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  prazo_acao date,
  combinado text NOT NULL CHECK (length(btrim(combinado)) BETWEEN 1 AND 4000),
  prazo_aceite timestamptz NOT NULL,
  registrado_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  -- Registro anterior a 10/2026, migrado do texto único de feedback: não tem responsável nem prazo da ação.
  legado boolean NOT NULL DEFAULT false,
  CONSTRAINT nc_feedbacks_versao_unica UNIQUE (nc_id, versao),
  CONSTRAINT nc_feedbacks_campos_obrigatorios CHECK (
    legado OR (responsavel_acao_id IS NOT NULL AND prazo_acao IS NOT NULL AND registrado_por IS NOT NULL)
  )
);

CREATE INDEX nc_feedbacks_responsavel_acao_idx ON public.nc_feedbacks (responsavel_acao_id);
CREATE INDEX nc_feedbacks_prazo_aceite_idx ON public.nc_feedbacks (prazo_aceite);

ALTER TABLE public.nc_feedbacks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nc_feedbacks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.nc_feedbacks TO service_role;
REVOKE ALL ON SEQUENCE public.nc_feedbacks_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.nc_feedbacks_id_seq TO service_role;

-- Evidência com feedback_id é anexo do feedback; sem, é evidência da abertura.
-- Sem ON DELETE explícito (NO ACTION, checado no fim do comando): a exclusão da NC remove
-- evidências e feedbacks em cascata no mesmo comando sem esbarrar na ordem das remoções.
ALTER TABLE public.evidencias
  ADD COLUMN feedback_id bigint REFERENCES public.nc_feedbacks(id);
CREATE INDEX evidencias_feedback_idx ON public.evidencias (feedback_id) WHERE feedback_id IS NOT NULL;

ALTER TABLE public.nao_conformidades
  ADD COLUMN aceito_fora_prazo boolean NOT NULL DEFAULT false;

-- ═══ Backfill (4.6): registros anteriores viram versão 1 legada, sem inventar causa raiz ═══

INSERT INTO public.nc_feedbacks (
  nc_id, versao, causa_raiz, acao_combinada, responsavel_acao_id, prazo_acao, combinado,
  prazo_aceite, registrado_por, registrado_em, legado
)
SELECT nc.id, 1,
       'Não informado (registro anterior a 10/2026)',
       'Não informado (registro anterior a 10/2026)',
       NULL, NULL,
       nc.feedback,
       public.somar_horas_expediente(coalesce(nc.feedback_aplicado_em, nc.atualizado_em), 18),
       nc.responsavel_id,
       coalesce(nc.feedback_aplicado_em, nc.atualizado_em),
       true
  FROM public.nao_conformidades AS nc
 WHERE nc.feedback IS NOT NULL AND btrim(nc.feedback) <> ''
   AND NOT EXISTS (SELECT 1 FROM public.nc_feedbacks AS f WHERE f.nc_id = nc.id);

-- ═══ Registro do feedback (4.4) ═══

CREATE OR REPLACE FUNCTION public.registrar_feedback_v4(
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
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_hoje date := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_causa_raiz text := pg_catalog.btrim(coalesce(p_causa_raiz, ''));
  v_acao text := pg_catalog.btrim(coalesce(p_acao, ''));
  v_combinado text := pg_catalog.btrim(coalesce(p_combinado, ''));
  v_responsavel_acao text;
  v_prazo_aceite timestamptz;
  v_versao integer;
  v_feedback_id bigint;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_responsavel_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status NOT IN ('aguardando_feedback'::public.status_nc, 'aguardando_analise'::public.status_nc) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;

  IF v_causa_raiz = '' OR length(v_causa_raiz) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'campo_obrigatorio', 'campo', 'causa_raiz');
  END IF;
  IF v_acao = '' OR length(v_acao) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'campo_obrigatorio', 'campo', 'acao_combinada');
  END IF;
  IF p_responsavel_acao_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'campo_obrigatorio', 'campo', 'responsavel_acao');
  END IF;
  IF p_prazo_acao IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'campo_obrigatorio', 'campo', 'prazo_acao');
  END IF;
  IF v_combinado = '' OR length(v_combinado) > 4000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'campo_obrigatorio', 'campo', 'combinado');
  END IF;
  IF p_prazo_acao < v_hoje THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'prazo_invalido', 'campo', 'prazo_acao');
  END IF;
  SELECT nome INTO v_responsavel_acao FROM public.usuarios WHERE id = p_responsavel_acao_id AND ativo;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'responsavel_invalido', 'campo', 'responsavel_acao');
  END IF;

  v_prazo_aceite := public.somar_horas_expediente(v_agora, 18);
  SELECT coalesce(max(versao), 0) + 1 INTO v_versao FROM public.nc_feedbacks WHERE nc_id = p_nc_id;

  INSERT INTO public.nc_feedbacks (
    nc_id, versao, causa_raiz, acao_combinada, responsavel_acao_id, prazo_acao, combinado,
    prazo_aceite, registrado_por, registrado_em
  ) VALUES (
    p_nc_id, v_versao, v_causa_raiz, v_acao, p_responsavel_acao_id, p_prazo_acao, v_combinado,
    v_prazo_aceite, p_responsavel_id, v_agora
  ) RETURNING id INTO v_feedback_id;

  -- Resumo legível em nao_conformidades.feedback mantém PDF, CSV e dossiê atuais funcionando.
  UPDATE public.nao_conformidades
  SET status = 'aguardando_aceite'::public.status_nc,
      responsavel_id = p_responsavel_id,
      feedback = 'Causa raiz: ' || v_causa_raiz
        || E'\nAção combinada: ' || v_acao
        || E'\nResponsável pela ação: ' || v_responsavel_acao
        || E'\nPrazo da ação: ' || pg_catalog.to_char(p_prazo_acao, 'DD/MM/YYYY')
        || E'\nCombinado: ' || v_combinado,
      feedback_aplicado_em = v_agora,
      aceito_fora_prazo = false
  WHERE id = p_nc_id;

  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_responsavel_id, v_nc.status, 'aguardando_aceite'::public.status_nc,
          'Feedback aplicado; aceite até ' || pg_catalog.to_char(v_prazo_aceite AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
          v_agora);

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'nc_id', p_nc_id, 'status', 'aguardando_aceite',
    'feedback_id', v_feedback_id, 'prazo_aceite', v_prazo_aceite
  );
END;
$$;

-- ═══ Prazo vencido → "Não respondida" (4.5) ═══

CREATE OR REPLACE FUNCTION public.marcar_nao_respondidas_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_agora timestamptz := pg_catalog.now();
  v_ids bigint[] := '{}';
  v_nc record;
BEGIN
  FOR v_nc IN
    SELECT nc.id
      FROM public.nao_conformidades AS nc
     WHERE nc.status = 'aguardando_aceite'::public.status_nc
       AND (
         SELECT f.prazo_aceite FROM public.nc_feedbacks AS f
          WHERE f.nc_id = nc.id ORDER BY f.versao DESC LIMIT 1
       ) <= v_agora
     ORDER BY nc.id
     FOR UPDATE OF nc SKIP LOCKED
  LOOP
    UPDATE public.nao_conformidades
       SET status = 'nao_respondida'::public.status_nc
     WHERE id = v_nc.id;
    INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
    VALUES (v_nc.id, NULL, 'aguardando_aceite'::public.status_nc, 'nao_respondida'::public.status_nc,
            'Prazo de aceite vencido sem resposta', v_agora);
    v_ids := v_ids || v_nc.id;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'marcadas', pg_catalog.cardinality(v_ids), 'nc_ids', pg_catalog.to_jsonb(v_ids));
END;
$$;

-- ═══ Aceite (4.5b): também depois de "Não respondida", marcado como fora do prazo ═══

CREATE OR REPLACE FUNCTION public.aceitar_nc_v4(p_nc_id bigint, p_colaborador_id uuid, p_texto_aceite text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_novo_status public.status_nc;
  v_prazo timestamptz;
  v_fora_prazo boolean;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id IS DISTINCT FROM p_colaborador_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'colaborador_incorreto');
  END IF;
  IF v_nc.status NOT IN ('aguardando_aceite'::public.status_nc, 'nao_respondida'::public.status_nc) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  SELECT prazo_aceite INTO v_prazo FROM public.nc_feedbacks WHERE nc_id = p_nc_id ORDER BY versao DESC LIMIT 1;
  -- Fora do prazo: já marcada como "Não respondida" ou vencida antes de o job passar.
  v_fora_prazo := v_nc.status = 'nao_respondida'::public.status_nc OR (v_prazo IS NOT NULL AND v_agora > v_prazo);
  v_novo_status := CASE WHEN v_nc.critica THEN 'em_plano_acao'::public.status_nc ELSE 'concluida'::public.status_nc END;

  UPDATE public.nao_conformidades
  SET status = v_novo_status, texto_aceite = p_texto_aceite, aceito_em = v_agora, aceito_fora_prazo = v_fora_prazo
  WHERE id = p_nc_id;

  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_colaborador_id, v_nc.status, v_novo_status,
          CASE WHEN v_fora_prazo THEN 'Aceite formal do colaborador fora do prazo' ELSE 'Aceite formal do colaborador' END
          || CASE WHEN v_nc.critica THEN '; NC crítica segue para o plano de ação' ELSE '' END,
          v_agora);

  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', v_novo_status, 'aceito_fora_prazo', v_fora_prazo);
END;
$$;

-- ═══ Reincidência (4.5c, D14): "Não respondida" e "Em plano de ação" contam como ocorrência ═══
-- (em_plano_acao incluído por decisão do responsável em 10/10: a NC crítica também foi validada.)
-- Mesma função, mesma assinatura; só a lista de status que contam como ocorrência muda.

CREATE OR REPLACE FUNCTION public.validar_nc_com_ocorrencias_v2(p_nc_id bigint, p_responsavel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
declare
    v_nc public.nao_conformidades%rowtype;
    v_causa record;
    v_numero integer;
    v_referencia date;
    v_agora timestamptz;
    v_reincidencia text := 'Não';
    v_ocorrencias jsonb := '[]'::jsonb;
begin
    select * into v_nc
      from public.nao_conformidades
     where id = p_nc_id
     for update;

    if not found then
        return pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada');
    end if;

    if v_nc.status <> 'aberta'::public.status_nc then
        return pg_catalog.jsonb_build_object(
            'ok', false,
            'erro', 'nc_nao_aberta',
            'status_atual', v_nc.status
        );
    end if;

    if v_nc.colaborador_id is null then
        return pg_catalog.jsonb_build_object('ok', false, 'erro', 'colaborador_ausente');
    end if;

    v_referencia := v_nc.data;

    for v_causa in
        select rel.causa_id
          from public.nc_causas as rel
         where rel.nc_id = p_nc_id
         order by rel.causa_id
    loop
        perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
                v_nc.colaborador_id::text || ':' || v_causa.causa_id::text,
                0
            )
        );

        select pg_catalog.count(*)::integer + 1
          into v_numero
          from public.nao_conformidades as anterior
          join public.nc_causas as rel_anterior
            on rel_anterior.nc_id = anterior.id
           and rel_anterior.causa_id = v_causa.causa_id
         where anterior.colaborador_id = v_nc.colaborador_id
           and anterior.id <> p_nc_id
           and anterior.status in (
                'validada'::public.status_nc,
                'aguardando_analise'::public.status_nc,
                'aguardando_feedback'::public.status_nc,
                'aguardando_aceite'::public.status_nc,
                'nao_respondida'::public.status_nc,
                'em_plano_acao'::public.status_nc,
                'concluida'::public.status_nc
           )
           and anterior.data >= (v_referencia - interval '12 months')::date
           and anterior.data <= v_referencia;

        update public.nc_causas
           set ocorrencia_numero = v_numero
         where nc_id = p_nc_id
           and causa_id = v_causa.causa_id;

        if v_numero > 1 then
            v_reincidencia := 'Sim';
        end if;

        v_ocorrencias := v_ocorrencias || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
                'causa_id', v_causa.causa_id,
                'ocorrencia_numero', v_numero
            )
        );
    end loop;

    v_agora := pg_catalog.now();

    update public.nao_conformidades
       set responsavel_id = p_responsavel_id,
           status = 'aguardando_feedback'::public.status_nc,
           validado_em = v_agora,
           enviado_em = v_agora,
           decidido_em = v_agora,
           reincidencia = v_reincidencia
     where id = p_nc_id;

    return pg_catalog.jsonb_build_object(
        'ok', true,
        'nc_id', p_nc_id,
        'status', 'aguardando_feedback',
        'reincidencia', v_reincidencia,
        'ocorrencias', v_ocorrencias
    );
end;
$$;

-- ═══ NC crítica (decisão de 10/10): também pode ser marcada quando está "Não respondida" ═══
-- Igual à v1, só com 'nao_respondida' entre os status aceitos. A NC continua "Não respondida"
-- e vai para o plano de ação após o aceite tardio (aceitar_nc_v4).

CREATE OR REPLACE FUNCTION public.definir_nc_critica_v2(p_nc_id bigint, p_usuario_id uuid, p_critica boolean, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_plano public.planos_acao%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_novo_status public.status_nc;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF pg_catalog.length(v_motivo) < 10 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_ausente');
  END IF;

  SELECT * INTO v_plano FROM public.planos_acao WHERE nc_id = p_nc_id FOR UPDATE;

  IF p_critica THEN
    IF v_nc.critica THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'ja_critica'); END IF;
    -- Só NCs já validadas: uma ocorrência em triagem ainda pode ser invalidada.
    IF v_nc.status NOT IN ('aguardando_feedback', 'aguardando_analise', 'validada', 'aguardando_aceite', 'nao_respondida', 'concluida') THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
    END IF;
    IF v_plano.id IS NOT NULL AND v_plano.status = 'concluido' THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_concluido');
    END IF;

    -- NC já aceita entra direto no acompanhamento; as demais entram após o aceite.
    v_novo_status := CASE WHEN v_nc.status = 'concluida' THEN 'em_plano_acao'::public.status_nc ELSE v_nc.status END;
    UPDATE public.nao_conformidades
    SET critica = true, critica_motivo = v_motivo, critica_marcada_por = p_usuario_id,
        critica_marcada_em = v_agora, status = v_novo_status
    WHERE id = p_nc_id;

    IF v_plano.id IS NULL THEN
      INSERT INTO public.planos_acao (nc_id, criado_por, atualizado_por)
      VALUES (p_nc_id, p_usuario_id, p_usuario_id)
      RETURNING * INTO v_plano;
    ELSE
      -- Plano cancelado anteriormente é reaberto preservando o que já foi registrado.
      UPDATE public.planos_acao
      SET status = 'planejamento', motivo_cancelamento = NULL, cancelado_por = NULL, cancelado_em = NULL,
          atualizado_por = p_usuario_id, atualizado_em = v_agora
      WHERE id = v_plano.id;
    END IF;

    INSERT INTO public.plano_acao_acompanhamentos (plano_id, usuario_id, tipo, texto, criado_em)
    VALUES (v_plano.id, p_usuario_id, 'evento', 'NC marcada como crítica: ' || v_motivo, v_agora);
    INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
    VALUES (p_nc_id, p_usuario_id, v_nc.status, v_novo_status, 'NC marcada como crítica: ' || v_motivo, v_agora);
  ELSE
    IF NOT v_nc.critica THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_critica'); END IF;
    IF v_plano.id IS NOT NULL AND v_plano.status = 'concluido' THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'plano_concluido');
    END IF;

    v_novo_status := CASE WHEN v_nc.status = 'em_plano_acao' THEN 'concluida'::public.status_nc ELSE v_nc.status END;
    UPDATE public.nao_conformidades
    SET critica = false, critica_motivo = NULL, critica_marcada_por = NULL, critica_marcada_em = NULL,
        status = v_novo_status
    WHERE id = p_nc_id;

    IF v_plano.id IS NOT NULL THEN
      -- O plano é cancelado, nunca apagado: a trilha permanece auditável.
      UPDATE public.planos_acao
      SET status = 'cancelado', motivo_cancelamento = v_motivo, cancelado_por = p_usuario_id,
          cancelado_em = v_agora, atualizado_por = p_usuario_id, atualizado_em = v_agora
      WHERE id = v_plano.id;
      INSERT INTO public.plano_acao_acompanhamentos (plano_id, usuario_id, tipo, texto, criado_em)
      VALUES (v_plano.id, p_usuario_id, 'evento', 'Criticidade removida e plano cancelado: ' || v_motivo, v_agora);
    END IF;
    INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
    VALUES (p_nc_id, p_usuario_id, v_nc.status, v_novo_status, 'Criticidade removida: ' || v_motivo, v_agora);
  END IF;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', v_novo_status, 'critica', p_critica);
END;
$function$;

-- ═══ Permissões: só o servidor (service_role) executa ═══

REVOKE ALL ON FUNCTION public.somar_horas_expediente(timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_feedback_v4(bigint, uuid, text, text, uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marcar_nao_respondidas_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aceitar_nc_v4(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.definir_nc_critica_v2(bigint, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.somar_horas_expediente(timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_feedback_v4(bigint, uuid, text, text, uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.marcar_nao_respondidas_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.aceitar_nc_v4(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.definir_nc_critica_v2(bigint, uuid, boolean, text) TO service_role;
