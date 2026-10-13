-- Plano de aderência ao processo de gestão de NCs (docs/plano-processo-gestao-nc.md), Fase 1.
--
-- Decisões de 13/10/2026:
--   - Ciclo de 12 meses por colaborador e causa, contado a partir da 1ª NC da causa. Fechada a janela,
--     tudo zera: a próxima NC dessa causa abre um ciclo novo (contador e escada de medidas).
--   - A cada 3 NCs da mesma causa no ciclo (3ª, 6ª, 9ª…) o colaborador fica passível de medida.
--   - Escada por causa (lei trabalhista): 1ª a 3ª medida do ciclo advertência, 4ª a 6ª suspensão,
--     7ª em diante avaliação de justa causa. Medidas reprovadas ou canceladas não contam.
--   - NC crítica deixa o colaborador passível de medida independentemente da contagem; a Qualidade
--     continua aprovando ou reprovando, como no fluxo de medidas.
--   - "Sugerida" segue como valor interno; na interface é "Passível de medida". O RH aplica presencialmente.
--   - Medidas pendentes da regra antiga (4ª ocorrência) são recalculadas (base de teste).

-- ═══ Origem da medida ═══

ALTER TABLE public.medidas_disciplinares
  ADD COLUMN origem text NOT NULL DEFAULT 'reincidencia' CHECK (origem IN ('reincidencia', 'nc_critica')),
  -- O gatilho deixa de ser a 4ª ocorrência: agora é a 3ª (reincidência) ou qualquer uma (NC crítica).
  DROP CONSTRAINT medidas_disciplinares_ocorrencia_gatilho_check,
  ADD CONSTRAINT medidas_disciplinares_ocorrencia_gatilho_check CHECK (ocorrencia_gatilho >= 1);

-- ═══ Contagem no ciclo ═══

-- Posição da NC no ciclo de 12 meses do colaborador para a causa, e o início desse ciclo.
-- Contam as NCs já validadas (mesma lista de status da reincidência) e a própria NC informada.
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
       AND (nc.id = p_nc_id OR nc.status IN (
             'validada'::public.status_nc, 'aguardando_analise'::public.status_nc, 'aguardando_feedback'::public.status_nc,
             'aguardando_aceite'::public.status_nc, 'nao_respondida'::public.status_nc, 'em_plano_acao'::public.status_nc,
             'concluida'::public.status_nc))
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

-- Tipo da próxima medida do ciclo: 1ª a 3ª advertência, 4ª a 6ª suspensão, 7ª em diante justa causa.
CREATE OR REPLACE FUNCTION public.proxima_medida_do_ciclo(p_colaborador_id uuid, p_causa_id bigint, p_inicio_ciclo date)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN n.ordem <= 3 THEN 'advertencia'
    WHEN n.ordem <= 6 THEN 'suspensao'
    ELSE 'avaliar_justa_causa'
  END
  FROM (
    SELECT pg_catalog.count(*)::integer + 1 AS ordem
      FROM public.medidas_disciplinares AS m
      JOIN public.nao_conformidades AS nc ON nc.id = m.nc_id
     WHERE m.colaborador_id = p_colaborador_id
       AND m.causa_id = p_causa_id
       AND m.status NOT IN ('reprovada', 'cancelada')
       AND coalesce(nc.data, nc.criado_em::date) >= p_inicio_ciclo
       AND coalesce(nc.data, nc.criado_em::date) < (p_inicio_ciclo + interval '12 months')::date
  ) AS n;
$$;

-- NC crítica: passível de medida independentemente da contagem (uma medida por NC).
-- A causa é a de maior ocorrência no ciclo (empate: menor id).
CREATE OR REPLACE FUNCTION public.medida_para_nc_critica(p_nc_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_causa record;
  v_ciclo record;
  v_tipo text;
  v_id bigint;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id;
  IF NOT FOUND OR v_nc.colaborador_id IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.medidas_disciplinares
              WHERE nc_id = p_nc_id AND status NOT IN ('reprovada', 'cancelada')) THEN
    RETURN NULL;
  END IF;
  SELECT rel.causa_id, rel.ocorrencia_numero INTO v_causa
    FROM public.nc_causas AS rel
   WHERE rel.nc_id = p_nc_id
   ORDER BY rel.ocorrencia_numero DESC NULLS LAST, rel.causa_id
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_ciclo FROM public.ocorrencia_no_ciclo(v_nc.colaborador_id, v_causa.causa_id, p_nc_id);
  v_tipo := public.proxima_medida_do_ciclo(v_nc.colaborador_id, v_causa.causa_id, v_ciclo.inicio_ciclo);
  INSERT INTO public.medidas_disciplinares (colaborador_id, causa_id, nc_id, ocorrencia_gatilho, tipo, tipo_sugerido, status, origem)
  VALUES (v_nc.colaborador_id, v_causa.causa_id, p_nc_id, coalesce(v_causa.ocorrencia_numero, v_ciclo.numero), v_tipo, v_tipo, 'sugerida', 'nc_critica')
  ON CONFLICT (nc_id, causa_id, ocorrencia_gatilho) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.medida_ao_marcar_critica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.medida_para_nc_critica(NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER medida_ao_marcar_critica AFTER UPDATE OF critica ON public.nao_conformidades
  FOR EACH ROW WHEN (NEW.critica AND NOT OLD.critica) EXECUTE FUNCTION public.medida_ao_marcar_critica();

-- ═══ Validação: contagem no ciclo e medida a cada 3 NCs ═══

CREATE OR REPLACE FUNCTION public.validar_nc_com_ocorrencias_v2(p_nc_id bigint, p_responsavel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
declare
    v_nc public.nao_conformidades%rowtype;
    v_causa record;
    v_ciclo record;
    v_agora timestamptz;
    v_reincidencia text := 'Não';
    v_ocorrencias jsonb := '[]'::jsonb;
    v_medida text;
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

        select * into v_ciclo from public.ocorrencia_no_ciclo(v_nc.colaborador_id, v_causa.causa_id, p_nc_id);

        update public.nc_causas
           set ocorrencia_numero = v_ciclo.numero
         where nc_id = p_nc_id
           and causa_id = v_causa.causa_id;

        if v_ciclo.numero > 1 then
            v_reincidencia := 'Sim';
        end if;

        v_medida := null;
        if v_ciclo.numero % 3 = 0 then
            v_medida := public.proxima_medida_do_ciclo(v_nc.colaborador_id, v_causa.causa_id, v_ciclo.inicio_ciclo);
            insert into public.medidas_disciplinares (colaborador_id, causa_id, nc_id, ocorrencia_gatilho, tipo, tipo_sugerido, status, origem)
            values (v_nc.colaborador_id, v_causa.causa_id, p_nc_id, v_ciclo.numero, v_medida, v_medida, 'sugerida', 'reincidencia')
            on conflict (nc_id, causa_id, ocorrencia_gatilho) do nothing;
        end if;

        v_ocorrencias := v_ocorrencias || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
                'causa_id', v_causa.causa_id,
                'ocorrencia_numero', v_ciclo.numero,
                'inicio_ciclo', v_ciclo.inicio_ciclo,
                'medida_sugerida', v_medida
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

-- ═══ Notificação: "passível de medida" (mesma matriz da Fase 5; muda só o texto da medida) ═══

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
      't', 'Sua NC #' || p_nc_id || ' foi reprovada', 'm', 'A Qualidade reprovou a NC que você abriu.');

  ELSIF p_evento = 'feedback_aplicado' THEN
    SELECT v_cand || coalesce(jsonb_agg(jsonb_build_object('u', q, 'papel', 'qualidade', 'p', 5,
      't', 'Feedback registrado na NC #' || p_nc_id, 'm', v_nome || ' tem até ' || v_prazo || ' para registrar o aceite.')), '[]')
      INTO v_cand FROM unnest(v_qualidade) AS q;
    v_cand := v_cand || jsonb_build_object('u', v_nc.colaborador_id, 'papel', 'acusado', 'p', 1, 'nivel', 'normal',
      't', 'NC #' || p_nc_id || ' precisa do seu aceite', 'm', 'Leia o feedback e registre o aceite até ' || v_prazo || '.',
      'chave', 'aceite:' || p_nc_id);
    -- R5: o responsável pela ação sempre é avisado, com link para a NC (decisão de 10/10).
    IF v_fb.responsavel_acao_id IS NOT NULL THEN
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
    IF v_fb.responsavel_acao_id IS NOT NULL THEN
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
        't', 'Colaborador passível de medida', 'm', v_nome || ' está passível de ' || v_rotulo_medida || ' (' ||
          CASE WHEN v_medida.origem = 'nc_critica' THEN 'NC crítica' ELSE v_medida.ocorrencia_gatilho || 'ª NC da mesma causa no ciclo' END || ').',
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

-- ═══ Recálculo pela regra nova (base de teste, autorizado em 13/10) ═══
-- Sem avisos em massa: o recálculo não dispara notificações de medida.

ALTER TABLE public.medidas_disciplinares DISABLE TRIGGER notificar_medida;

UPDATE public.medidas_disciplinares
   SET status = 'cancelada',
       motivo_decisao = 'Recalculada pela regra de 13/10/2026 (a cada 3 NCs da mesma causa no ciclo de 12 meses).'
 WHERE status = 'sugerida';

DO $$
DECLARE
  v_item record;
  v_ciclo record;
  v_tipo text;
BEGIN
  FOR v_item IN
    SELECT nc.id AS nc_id, nc.colaborador_id, rel.causa_id
      FROM public.nao_conformidades AS nc
      JOIN public.nc_causas AS rel ON rel.nc_id = nc.id
     WHERE nc.colaborador_id IS NOT NULL
       AND nc.status IN ('validada', 'aguardando_analise', 'aguardando_feedback', 'aguardando_aceite',
                         'nao_respondida', 'em_plano_acao', 'concluida')
     ORDER BY coalesce(nc.data, nc.criado_em::date), nc.id, rel.causa_id
  LOOP
    SELECT * INTO v_ciclo FROM public.ocorrencia_no_ciclo(v_item.colaborador_id, v_item.causa_id, v_item.nc_id);
    UPDATE public.nc_causas SET ocorrencia_numero = v_ciclo.numero
     WHERE nc_id = v_item.nc_id AND causa_id = v_item.causa_id;
    IF v_ciclo.numero % 3 = 0 AND NOT EXISTS (
         SELECT 1 FROM public.medidas_disciplinares
          WHERE nc_id = v_item.nc_id AND causa_id = v_item.causa_id AND status NOT IN ('reprovada', 'cancelada')) THEN
      v_tipo := public.proxima_medida_do_ciclo(v_item.colaborador_id, v_item.causa_id, v_ciclo.inicio_ciclo);
      INSERT INTO public.medidas_disciplinares (colaborador_id, causa_id, nc_id, ocorrencia_gatilho, tipo, tipo_sugerido, status, origem)
      VALUES (v_item.colaborador_id, v_item.causa_id, v_item.nc_id, v_ciclo.numero, v_tipo, v_tipo, 'sugerida', 'reincidencia')
      ON CONFLICT (nc_id, causa_id, ocorrencia_gatilho) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.nao_conformidades AS nc
     SET reincidencia = CASE WHEN EXISTS (SELECT 1 FROM public.nc_causas AS rel
                                           WHERE rel.nc_id = nc.id AND rel.ocorrencia_numero > 1) THEN 'Sim' ELSE 'Não' END
   WHERE nc.status IN ('validada', 'aguardando_analise', 'aguardando_feedback', 'aguardando_aceite',
                       'nao_respondida', 'em_plano_acao', 'concluida');

  PERFORM public.medida_para_nc_critica(nc.id)
     FROM public.nao_conformidades AS nc
    WHERE nc.critica;
END;
$$;

ALTER TABLE public.medidas_disciplinares ENABLE TRIGGER notificar_medida;

-- ═══ Permissões ═══

REVOKE ALL ON FUNCTION public.ocorrencia_no_ciclo(uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.proxima_medida_do_ciclo(uuid, bigint, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.medida_para_nc_critica(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.medida_ao_marcar_critica() FROM PUBLIC, anon, authenticated;
