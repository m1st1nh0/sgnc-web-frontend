-- Fase 4B do retorno da diretoria: medida disciplinar em etapas (D19, D21).
--
--   sugerida (a validação atinge o gatilho) → aprovada | reprovada (motivo obrigatório) → aplicada
--
--   * Só alguém da Qualidade (papéis 'qualidade' e 'adm') que NÃO seja o colaborador da NC decide ou aplica (D19).
--     A regra vale também no banco (CHECK), além das RPCs e da API.
--   * A medida sugerida nasce na mesma transação da validação (validar_nc_com_ocorrencias_v2).
--   * Duplicidade (mesma NC, causa e ocorrência) já é barrada pelo índice único uq_medida_por_nc_causa_ocorrencia.
-- A tabela estava vazia em 10/10 (0 linhas), então não há dado a migrar.

ALTER TABLE public.medidas_disciplinares
  DROP CONSTRAINT medidas_disciplinares_status_check,
  ADD CONSTRAINT medidas_disciplinares_status_check
    CHECK (status IN ('sugerida', 'aprovada', 'reprovada', 'aplicada', 'cancelada')),
  ALTER COLUMN status SET DEFAULT 'sugerida',
  -- Medida sugerida ainda não foi aplicada: quem aplicou e a data só existem na etapa "aplicada".
  ALTER COLUMN aplicada_por DROP NOT NULL,
  ALTER COLUMN data_aplicacao DROP NOT NULL,
  ALTER COLUMN data_aplicacao DROP DEFAULT,
  ADD COLUMN decidida_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN decidida_em timestamptz,
  ADD COLUMN motivo_decisao text CHECK (motivo_decisao IS NULL OR length(btrim(motivo_decisao)) BETWEEN 1 AND 1000),
  ADD COLUMN aplicada_em timestamptz,
  -- D19 no banco: o colaborador da NC nunca decide nem aplica a própria medida.
  ADD CONSTRAINT medidas_disciplinares_segregacao CHECK (
    decidida_por IS DISTINCT FROM colaborador_id AND aplicada_por IS DISTINCT FROM colaborador_id
  ),
  ADD CONSTRAINT medidas_disciplinares_decisao_consistente CHECK (
    status NOT IN ('aprovada', 'reprovada', 'aplicada') OR (decidida_por IS NOT NULL AND decidida_em IS NOT NULL)
  ),
  ADD CONSTRAINT medidas_disciplinares_reprovacao_motivada CHECK (
    status <> 'reprovada' OR motivo_decisao IS NOT NULL
  ),
  ADD CONSTRAINT medidas_disciplinares_aplicacao_consistente CHECK (
    status <> 'aplicada' OR (aplicada_por IS NOT NULL AND aplicada_em IS NOT NULL AND data_aplicacao IS NOT NULL)
  ),
  ADD CONSTRAINT medidas_disciplinares_suspensao_com_dias CHECK (
    status <> 'aplicada' OR tipo <> 'suspensao' OR dias_suspensao IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_medidas_disciplinares_pendentes
  ON public.medidas_disciplinares (status) WHERE status IN ('sugerida', 'aprovada');

-- ═══ Medida sugerida pela regra de ciclos (mesma de suggestedMeasure na API) ═══
-- A partir da 4ª ocorrência, a cada 3 ocorrências: 1ª a 3ª medida advertência, 4ª a 6ª suspensão, depois avaliar justa causa.

CREATE OR REPLACE FUNCTION public.medida_sugerida_para(p_ocorrencia integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_ocorrencia IS NULL OR p_ocorrencia < 4 OR (p_ocorrencia - 4) % 3 <> 0 THEN NULL
    WHEN (p_ocorrencia - 4) / 3 + 1 <= 3 THEN 'advertencia'
    WHEN (p_ocorrencia - 4) / 3 + 1 <= 6 THEN 'suspensao'
    ELSE 'avaliar_justa_causa'
  END;
$$;

-- ═══ Validação (4B.2): cria a medida "sugerida" na mesma transação quando a ocorrência atinge o gatilho ═══
-- Igual à versão da Fase 4 (nao_respondida e em_plano_acao contam), acrescida da medida sugerida.

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

        v_medida := public.medida_sugerida_para(v_numero);
        if v_medida is not null then
            insert into public.medidas_disciplinares (colaborador_id, causa_id, nc_id, ocorrencia_gatilho, tipo, status)
            values (v_nc.colaborador_id, v_causa.causa_id, p_nc_id, v_numero, v_medida, 'sugerida')
            on conflict (nc_id, causa_id, ocorrencia_gatilho) do nothing;
        end if;

        v_ocorrencias := v_ocorrencias || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
                'causa_id', v_causa.causa_id,
                'ocorrencia_numero', v_numero,
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

-- ═══ Decisão (4B.3): aprovar ou reprovar uma medida sugerida ═══

CREATE OR REPLACE FUNCTION public.decidir_medida_v1(p_medida_id bigint, p_usuario_id uuid, p_decisao text, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_medida public.medidas_disciplinares%ROWTYPE;
  v_motivo text := nullif(pg_catalog.btrim(coalesce(p_motivo, '')), '');
  v_novo text;
BEGIN
  SELECT * INTO v_medida FROM public.medidas_disciplinares WHERE id = p_medida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'medida_nao_encontrada'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_medida.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_medida.status <> 'sugerida' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_medida.status);
  END IF;
  IF p_decisao NOT IN ('aprovar', 'reprovar') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'decisao_invalida');
  END IF;
  IF p_decisao = 'reprovar' AND (v_motivo IS NULL OR length(v_motivo) < 10) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_ausente', 'campo', 'motivo');
  END IF;
  IF length(coalesce(v_motivo, '')) > 1000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_longo', 'campo', 'motivo');
  END IF;

  v_novo := CASE WHEN p_decisao = 'aprovar' THEN 'aprovada' ELSE 'reprovada' END;
  UPDATE public.medidas_disciplinares
     SET status = v_novo, decidida_por = p_usuario_id, decidida_em = pg_catalog.now(), motivo_decisao = v_motivo
   WHERE id = p_medida_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'medida_id', p_medida_id, 'status', v_novo, 'nc_id', v_medida.nc_id);
END;
$$;

-- ═══ Aplicação (4B.3): registrar que a medida aprovada foi aplicada ═══

CREATE OR REPLACE FUNCTION public.aplicar_medida_v1(
  p_medida_id bigint,
  p_usuario_id uuid,
  p_data date,
  p_dias_suspensao integer,
  p_observacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_medida public.medidas_disciplinares%ROWTYPE;
  v_hoje date := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_data date := coalesce(p_data, (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_observacao text := nullif(pg_catalog.btrim(coalesce(p_observacao, '')), '');
BEGIN
  SELECT * INTO v_medida FROM public.medidas_disciplinares WHERE id = p_medida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'medida_nao_encontrada'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo AND papel IN ('adm'::public.papel_usuario, 'qualidade'::public.papel_usuario)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_medida.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_medida.status <> 'aprovada' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_medida.status);
  END IF;
  IF v_data > v_hoje THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'data_futura', 'campo', 'data');
  END IF;
  IF v_medida.tipo = 'suspensao' AND (p_dias_suspensao IS NULL OR p_dias_suspensao NOT BETWEEN 1 AND 30) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'dias_invalidos', 'campo', 'dias_suspensao');
  END IF;
  IF v_medida.tipo <> 'suspensao' AND p_dias_suspensao IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'dias_invalidos', 'campo', 'dias_suspensao');
  END IF;
  IF length(coalesce(v_observacao, '')) > 1000 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'observacao_longa', 'campo', 'observacao');
  END IF;

  UPDATE public.medidas_disciplinares
     SET status = 'aplicada', aplicada_por = p_usuario_id, aplicada_em = pg_catalog.now(),
         data_aplicacao = v_data, dias_suspensao = p_dias_suspensao,
         observacao = coalesce(v_observacao, observacao)
   WHERE id = p_medida_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'medida_id', p_medida_id, 'status', 'aplicada', 'nc_id', v_medida.nc_id);
END;
$$;

REVOKE ALL ON FUNCTION public.medida_sugerida_para(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decidir_medida_v1(bigint, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_medida_v1(bigint, uuid, date, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.medida_sugerida_para(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.decidir_medida_v1(bigint, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_medida_v1(bigint, uuid, date, integer, text) TO service_role;
