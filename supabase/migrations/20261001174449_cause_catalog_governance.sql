-- Governed cause catalog and approval queue. Existing cause IDs and NC links stay intact.
ALTER TABLE public.causas
  ADD COLUMN ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN descricao_normalizada text
    GENERATED ALWAYS AS (lower(regexp_replace(btrim(descricao), '\s+', ' ', 'g'))) STORED;

CREATE UNIQUE INDEX causas_descricao_normalizada_uidx
  ON public.causas (descricao_normalizada);

INSERT INTO public.causas (descricao)
VALUES
  ('Chamado sem previsão'),
  ('Chamado com previsão vencida'),
  ('Não retornou ao cliente'),
  ('Sem apontamento'),
  ('Assunto não aplicado'),
  ('Não seguiu a macro'),
  ('Direcionamento fila errada'),
  ('Chamado não encerrado no mesmo dia'),
  ('Campo solicitante não ajustado'),
  ('Apontamento de horas incoerente'),
  ('Conduta contra o regulamento interno'),
  ('Erros de ponto')
ON CONFLICT (descricao_normalizada) DO NOTHING;

-- Legacy options stay available on historical NCs but are no longer selectable for new ones.
UPDATE public.causas
SET ativo = descricao_normalizada = ANY (ARRAY[
  lower('Chamado sem previsão'),
  lower('Chamado com previsão vencida'),
  lower('Não retornou ao cliente'),
  lower('Sem apontamento'),
  lower('Assunto não aplicado'),
  lower('Não seguiu a macro'),
  lower('Direcionamento fila errada'),
  lower('Chamado não encerrado no mesmo dia'),
  lower('Campo solicitante não ajustado'),
  lower('Apontamento de horas incoerente'),
  lower('Conduta contra o regulamento interno'),
  lower('Erros de ponto')
]);

DROP POLICY IF EXISTS causas_select_autenticado ON public.causas;
CREATE POLICY causas_select_autenticado
  ON public.causas
  FOR SELECT
  TO authenticated
  USING (ativo);

CREATE TABLE public.solicitacoes_causa (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  descricao text NOT NULL CHECK (length(btrim(descricao)) BETWEEN 3 AND 120),
  descricao_normalizada text
    GENERATED ALWAYS AS (lower(regexp_replace(btrim(descricao), '\s+', ' ', 'g'))) STORED,
  justificativa text NOT NULL CHECK (length(btrim(justificativa)) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'associada', 'rejeitada')),
  solicitado_por uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  decidido_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  decidido_em timestamptz,
  causa_id bigint REFERENCES public.causas(id) ON DELETE RESTRICT,
  observacao_decisao text,
  CONSTRAINT solicitacoes_causa_decisao_consistente CHECK (
    (status = 'pendente' AND decidido_por IS NULL AND decidido_em IS NULL AND causa_id IS NULL)
    OR (status = 'rejeitada' AND decidido_por IS NOT NULL AND decidido_em IS NOT NULL AND causa_id IS NULL)
    OR (status IN ('aprovada', 'associada') AND decidido_por IS NOT NULL AND decidido_em IS NOT NULL AND causa_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX solicitacoes_causa_pendente_normalizada_uidx
  ON public.solicitacoes_causa (descricao_normalizada)
  WHERE status = 'pendente';
CREATE INDEX solicitacoes_causa_status_data_idx
  ON public.solicitacoes_causa (status, solicitado_em DESC);

ALTER TABLE public.solicitacoes_causa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.solicitacoes_causa FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.solicitacoes_causa TO service_role;
REVOKE ALL ON SEQUENCE public.solicitacoes_causa_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.solicitacoes_causa_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.decidir_solicitacao_causa(
  p_solicitacao_id bigint,
  p_decisor_id uuid,
  p_decisao text,
  p_observacao text,
  p_causa_existente_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_solicitacao public.solicitacoes_causa%ROWTYPE;
  v_causa_id bigint;
  v_status text;
BEGIN
  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_causa
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'solicitacao_nao_encontrada');
  END IF;
  IF v_solicitacao.status <> 'pendente' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'solicitacao_ja_decidida');
  END IF;
  IF p_decisor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'decisor_ausente');
  END IF;

  IF p_decisao = 'rejeitar' THEN
    IF length(btrim(coalesce(p_observacao, ''))) < 3 THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'motivo_rejeicao_ausente');
    END IF;
    v_status := 'rejeitada';
  ELSIF p_decisao = 'aprovar' THEN
    IF p_causa_existente_id IS NOT NULL THEN
      SELECT id INTO v_causa_id
      FROM public.causas
      WHERE id = p_causa_existente_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'erro', 'causa_existente_nao_encontrada');
      END IF;
      UPDATE public.causas SET ativo = true WHERE id = v_causa_id;
      v_status := 'associada';
    ELSE
      SELECT id INTO v_causa_id
      FROM public.causas
      WHERE descricao_normalizada = v_solicitacao.descricao_normalizada
      FOR UPDATE;
      IF FOUND THEN
        UPDATE public.causas SET ativo = true WHERE id = v_causa_id;
        v_status := 'associada';
      ELSE
        INSERT INTO public.causas (descricao, criado_por, ativo)
        VALUES (v_solicitacao.descricao, p_decisor_id, true)
        ON CONFLICT (descricao_normalizada) DO NOTHING
        RETURNING id INTO v_causa_id;
        IF v_causa_id IS NULL THEN
          SELECT id INTO v_causa_id
          FROM public.causas
          WHERE descricao_normalizada = v_solicitacao.descricao_normalizada
          FOR UPDATE;
          UPDATE public.causas SET ativo = true WHERE id = v_causa_id;
          v_status := 'associada';
        ELSE
          v_status := 'aprovada';
        END IF;
      END IF;
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'erro', 'decisao_invalida');
  END IF;

  UPDATE public.solicitacoes_causa
  SET status = v_status,
      decidido_por = p_decisor_id,
      decidido_em = now(),
      causa_id = CASE WHEN v_status = 'rejeitada' THEN NULL ELSE v_causa_id END,
      observacao_decisao = nullif(btrim(p_observacao), '')
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'causa_id', v_causa_id);
END;
$$;

REVOKE ALL ON FUNCTION public.decidir_solicitacao_causa(bigint, uuid, text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_solicitacao_causa(bigint, uuid, text, text, bigint) TO service_role;
