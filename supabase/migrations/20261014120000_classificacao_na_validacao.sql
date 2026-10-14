-- Plano de aderência ao processo de gestão de NCs (docs/plano-processo-gestao-nc.md), Fase 2.
--
-- Decisões de 14/10/2026 (Q6 e Q7):
--   - Na validação, a Qualidade informa a ORIGEM da NC (monitoria, auditoria, supervisão, indicador
--     ou reclamação), obrigatória. Quem abre a NC não informa a origem.
--   - Na validação, a Qualidade pode informar o procedimento descumprido e o link da intranet, ambos
--     opcionais (pode haver NC sem procedimento publicado).
--   - Na validação, a Qualidade marca a NC como COBRANÇA ou ORIENTATIVA. A orientativa não conta para
--     reincidência nem para medida disciplinar (nem quando é crítica).
--   - Causa individual ou sistêmica não vira regra: fica como observação no feedback.

-- ═══ Colunas da classificação ═══

ALTER TABLE public.nao_conformidades
  ADD COLUMN origem text CHECK (origem IN ('monitoria', 'auditoria', 'supervisao', 'indicador', 'reclamacao')),
  ADD COLUMN tipo_nc text NOT NULL DEFAULT 'cobranca' CHECK (tipo_nc IN ('cobranca', 'orientativa')),
  ADD COLUMN procedimento text CHECK (procedimento IS NULL OR length(btrim(procedimento)) BETWEEN 1 AND 300),
  ADD COLUMN procedimento_url text CHECK (procedimento_url IS NULL OR (procedimento_url ~* '^https?://' AND length(procedimento_url) <= 500));

-- ═══ Contagem no ciclo: só NC de cobrança conta ═══

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

-- ═══ Validação de ocorrências: NC orientativa não conta nem gera medida ═══

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

    -- NC orientativa (sem procedimento a cobrar) não conta para reincidência nem medida.
    if v_nc.tipo_nc = 'orientativa' then
        update public.nc_causas set ocorrencia_numero = null where nc_id = p_nc_id;
    end if;

    for v_causa in
        select rel.causa_id
          from public.nc_causas as rel
         where rel.nc_id = p_nc_id
           and v_nc.tipo_nc = 'cobranca'
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

-- ═══ NC crítica: orientativa não gera medida ═══

CREATE OR REPLACE FUNCTION public.medida_para_nc_critica(p_nc_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_causa record;
  v_ciclo record;
  v_tipo text;
  v_criadas integer := 0;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id;
  IF NOT FOUND OR v_nc.colaborador_id IS NULL THEN RETURN 0; END IF;
  -- NC orientativa não gera medida, nem quando é crítica.
  IF v_nc.tipo_nc = 'orientativa' THEN RETURN 0; END IF;
  FOR v_causa IN
    SELECT rel.causa_id, rel.ocorrencia_numero FROM public.nc_causas AS rel WHERE rel.nc_id = p_nc_id ORDER BY rel.causa_id
  LOOP
    UPDATE public.medidas_disciplinares
       SET origem = 'reincidencia_e_critica'
     WHERE nc_id = p_nc_id AND causa_id = v_causa.causa_id
       AND status NOT IN ('reprovada', 'cancelada') AND origem = 'reincidencia';
    IF EXISTS (SELECT 1 FROM public.medidas_disciplinares
                WHERE nc_id = p_nc_id AND causa_id = v_causa.causa_id AND status NOT IN ('reprovada', 'cancelada')) THEN
      CONTINUE;
    END IF;
    SELECT * INTO v_ciclo FROM public.ocorrencia_no_ciclo(v_nc.colaborador_id, v_causa.causa_id, p_nc_id);
    v_tipo := public.proxima_medida_do_ciclo(v_nc.colaborador_id, v_causa.causa_id, v_ciclo.inicio_ciclo);
    INSERT INTO public.medidas_disciplinares (colaborador_id, causa_id, nc_id, ocorrencia_gatilho, tipo, tipo_sugerido, status, origem)
    VALUES (v_nc.colaborador_id, v_causa.causa_id, p_nc_id, coalesce(v_causa.ocorrencia_numero, v_ciclo.numero), v_tipo, v_tipo, 'sugerida', 'nc_critica')
    ON CONFLICT (nc_id, causa_id, ocorrencia_gatilho) DO NOTHING;
    IF FOUND THEN v_criadas := v_criadas + 1; END IF;
  END LOOP;
  RETURN v_criadas;
END;
$$;

-- ═══ Validação v4: grava a classificação e valida na mesma transação ═══

CREATE OR REPLACE FUNCTION public.validar_nc_com_workflow_v4(
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
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_procedimento text := nullif(pg_catalog.btrim(coalesce(p_procedimento, '')), '');
  v_url text := nullif(pg_catalog.btrim(coalesce(p_procedimento_url, '')), '');
BEGIN
  IF p_origem IS NULL OR p_origem NOT IN ('monitoria', 'auditoria', 'supervisao', 'indicador', 'reclamacao') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'origem_invalida');
  END IF;
  IF p_tipo_nc IS NULL OR p_tipo_nc NOT IN ('cobranca', 'orientativa') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'tipo_invalido');
  END IF;
  IF v_procedimento IS NOT NULL AND length(v_procedimento) > 300 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'procedimento_invalido');
  END IF;
  IF v_url IS NOT NULL AND (v_url !~* '^https?://' OR length(v_url) > 500) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'procedimento_url_invalido');
  END IF;

  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_responsavel_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status <> 'aberta'::public.status_nc THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_aberta', 'status_atual', v_nc.status);
  END IF;
  IF v_nc.colaborador_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'colaborador_ausente');
  END IF;

  UPDATE public.nao_conformidades
     SET origem = p_origem, tipo_nc = p_tipo_nc, procedimento = v_procedimento, procedimento_url = v_url
   WHERE id = p_nc_id;

  RETURN public.validar_nc_com_workflow_v3(p_nc_id, p_responsavel_id);
END;
$$;

REVOKE ALL ON FUNCTION public.validar_nc_com_workflow_v4(bigint, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_nc_com_workflow_v4(bigint, uuid, text, text, text, text) TO service_role;
