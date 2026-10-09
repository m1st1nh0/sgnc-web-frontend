-- NC crítica + plano de ação (planejamento, execução e acompanhamento).
--
-- Regras de segregação de funções aplicadas também no banco (defesa em profundidade;
-- a API Next.js aplica as mesmas regras antes de chamar estas funções):
--   * Só a Qualidade (adm) marca/desmarca uma NC como crítica e conclui o plano.
--   * Qualidade e a liderança hierárquica do colaborador alimentam o plano.
--   * O colaborador analisado (objeto da NC) nunca marca, alimenta, aprova ou decide
--     nada sobre a própria NC, mesmo que seja adm ou supervisor.
--   * Quem executa as ações do plano não pode verificar a eficácia (aprovar) o plano.
--   * O registro de acompanhamento é somente inserção: não há UPDATE/DELETE.

ALTER TABLE public.nao_conformidades
  ADD COLUMN critica boolean NOT NULL DEFAULT false,
  ADD COLUMN critica_motivo text,
  ADD COLUMN critica_marcada_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN critica_marcada_em timestamptz,
  ADD CONSTRAINT nao_conformidades_critica_consistente CHECK (
    (critica AND critica_motivo IS NOT NULL AND critica_marcada_por IS NOT NULL AND critica_marcada_em IS NOT NULL)
    OR (NOT critica AND critica_motivo IS NULL AND critica_marcada_por IS NULL AND critica_marcada_em IS NULL)
  ),
  ADD CONSTRAINT nao_conformidades_plano_exige_critica CHECK (
    status <> 'em_plano_acao'::public.status_nc OR critica
  );

CREATE INDEX nao_conformidades_critica_idx ON public.nao_conformidades (critica) WHERE critica;

CREATE TABLE public.planos_acao (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nc_id bigint NOT NULL UNIQUE REFERENCES public.nao_conformidades(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'planejamento'
    CHECK (status IN ('planejamento', 'em_execucao', 'em_acompanhamento', 'concluido', 'cancelado')),
  -- Planejamento
  causa_raiz text CHECK (causa_raiz IS NULL OR length(causa_raiz) <= 4000),
  acoes text CHECK (acoes IS NULL OR length(acoes) <= 4000),
  responsavel_execucao_id uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  prazo date,
  -- Execução
  execucao text CHECK (execucao IS NULL OR length(execucao) <= 4000),
  -- Verificação de eficácia (encerramento)
  verificacao_eficacia text CHECK (verificacao_eficacia IS NULL OR length(verificacao_eficacia) <= 4000),
  concluido_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  concluido_em timestamptz,
  motivo_cancelamento text,
  cancelado_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  cancelado_em timestamptz,
  criado_por uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planos_acao_execucao_planejada CHECK (
    status NOT IN ('em_execucao', 'em_acompanhamento', 'concluido')
    OR (causa_raiz IS NOT NULL AND acoes IS NOT NULL AND responsavel_execucao_id IS NOT NULL AND prazo IS NOT NULL)
  ),
  CONSTRAINT planos_acao_acompanhamento_executado CHECK (
    status NOT IN ('em_acompanhamento', 'concluido') OR execucao IS NOT NULL
  ),
  CONSTRAINT planos_acao_conclusao_consistente CHECK (
    (status = 'concluido') = (concluido_por IS NOT NULL AND concluido_em IS NOT NULL AND verificacao_eficacia IS NOT NULL)
  ),
  CONSTRAINT planos_acao_cancelamento_consistente CHECK (
    (status = 'cancelado') = (cancelado_por IS NOT NULL AND cancelado_em IS NOT NULL AND motivo_cancelamento IS NOT NULL)
  ),
  -- Segregação: quem executa não verifica a eficácia.
  CONSTRAINT planos_acao_verificador_independente CHECK (
    concluido_por IS NULL OR concluido_por IS DISTINCT FROM responsavel_execucao_id
  )
);

CREATE INDEX planos_acao_status_idx ON public.planos_acao (status);
CREATE INDEX planos_acao_responsavel_execucao_idx ON public.planos_acao (responsavel_execucao_id);

CREATE TABLE public.plano_acao_acompanhamentos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plano_id bigint NOT NULL REFERENCES public.planos_acao(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  -- 'registro': anotação de acompanhamento; 'evento': trilha automática de alterações.
  tipo text NOT NULL CHECK (tipo IN ('registro', 'evento')),
  texto text NOT NULL CHECK (length(btrim(texto)) BETWEEN 3 AND 4000),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plano_acao_acompanhamentos_plano_idx ON public.plano_acao_acompanhamentos (plano_id, criado_em);

ALTER TABLE public.planos_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acao_acompanhamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY planos_acao_explicit_deny ON public.planos_acao
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY plano_acao_acompanhamentos_explicit_deny ON public.plano_acao_acompanhamentos
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.planos_acao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.plano_acao_acompanhamentos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.planos_acao TO service_role;
-- Trilha de auditoria: nem o service role pode reescrever ou apagar registros.
GRANT SELECT, INSERT ON TABLE public.plano_acao_acompanhamentos TO service_role;
REVOKE ALL ON SEQUENCE public.planos_acao_id_seq, public.plano_acao_acompanhamentos_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.planos_acao_id_seq, public.plano_acao_acompanhamentos_id_seq TO service_role;

-- Verdadeiro quando p_usuario_id é supervisor na cadeia hierárquica acima do colaborador.
-- Espelha listarPessoasAbaixo(): adm não entra na hierarquia e só supervisores propagam.
CREATE OR REPLACE FUNCTION public.nc_lidera_colaborador(p_usuario_id uuid, p_colaborador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH RECURSIVE acima(id, nivel) AS (
    SELECT u.supervisor_id, 1
    FROM public.usuarios u
    WHERE u.id = p_colaborador_id AND u.papel <> 'adm'::public.papel_usuario
    UNION ALL
    SELECT u.supervisor_id, a.nivel + 1
    FROM acima a
    JOIN public.usuarios u ON u.id = a.id
    WHERE u.papel = 'supervisor'::public.papel_usuario AND u.supervisor_id IS NOT NULL AND a.nivel < 50
  )
  SELECT p_usuario_id IS NOT NULL
    AND p_usuario_id IS DISTINCT FROM p_colaborador_id
    AND EXISTS (
      SELECT 1 FROM acima a
      JOIN public.usuarios u ON u.id = a.id
      WHERE a.id = p_usuario_id AND u.papel = 'supervisor'::public.papel_usuario AND u.ativo
    );
$$;

-- Marca ou desmarca a NC como crítica. Exclusivo da Qualidade, nunca do próprio colaborador.
CREATE OR REPLACE FUNCTION public.definir_nc_critica_v1(
  p_nc_id bigint,
  p_usuario_id uuid,
  p_critica boolean,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
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
    SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo AND papel = 'adm'::public.papel_usuario
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
    IF v_nc.status NOT IN ('aguardando_feedback', 'aguardando_analise', 'validada', 'aguardando_aceite', 'concluida') THEN
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
$$;

-- Quem pode alimentar o plano: Qualidade ou liderança do colaborador, nunca o próprio colaborador.
CREATE OR REPLACE FUNCTION public.nc_pode_alimentar_plano(p_usuario_id uuid, p_colaborador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p_usuario_id IS NOT NULL
    AND p_usuario_id IS DISTINCT FROM p_colaborador_id
    AND (
      EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo AND papel = 'adm'::public.papel_usuario)
      OR public.nc_lidera_colaborador(p_usuario_id, p_colaborador_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.salvar_plano_acao_v1(
  p_nc_id bigint,
  p_usuario_id uuid,
  p_status text,
  p_causa_raiz text,
  p_acoes text,
  p_responsavel_execucao_id uuid,
  p_prazo date,
  p_execucao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
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
  IF NOT v_nc.critica THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_critica'); END IF;

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

CREATE OR REPLACE FUNCTION public.registrar_acompanhamento_plano_v1(
  p_nc_id bigint,
  p_usuario_id uuid,
  p_texto text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
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
  IF NOT v_nc.critica THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_critica'); END IF;
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

-- Verificação de eficácia e encerramento: Qualidade, independente do colaborador e do executor.
CREATE OR REPLACE FUNCTION public.concluir_plano_acao_v1(
  p_nc_id bigint,
  p_usuario_id uuid,
  p_verificacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_plano public.planos_acao%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_verificacao text := pg_catalog.btrim(coalesce(p_verificacao, ''));
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo AND papel = 'adm'::public.papel_usuario
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_nc.colaborador_id = p_usuario_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status <> 'em_plano_acao'::public.status_nc THEN
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
  IF NOT EXISTS (
    SELECT 1 FROM public.plano_acao_acompanhamentos WHERE plano_id = v_plano.id AND tipo = 'registro'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_acompanhamento');
  END IF;
  IF pg_catalog.length(v_verificacao) < 10 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'verificacao_ausente');
  END IF;

  UPDATE public.planos_acao
  SET status = 'concluido', verificacao_eficacia = v_verificacao, concluido_por = p_usuario_id,
      concluido_em = v_agora, atualizado_por = p_usuario_id, atualizado_em = v_agora
  WHERE id = v_plano.id;
  INSERT INTO public.plano_acao_acompanhamentos (plano_id, usuario_id, tipo, texto, criado_em)
  VALUES (v_plano.id, p_usuario_id, 'evento', 'Eficácia verificada e plano concluído', v_agora);
  UPDATE public.nao_conformidades SET status = 'concluida'::public.status_nc WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_usuario_id, 'em_plano_acao'::public.status_nc, 'concluida'::public.status_nc,
          'Plano de ação concluído com eficácia verificada', v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', 'concluida');
END;
$$;

-- Aceite: NC crítica segue para o acompanhamento do plano em vez de ser concluída.
CREATE OR REPLACE FUNCTION public.aceitar_nc_v3(p_nc_id bigint, p_colaborador_id uuid, p_texto_aceite text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_novo_status public.status_nc;
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id IS DISTINCT FROM p_colaborador_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'colaborador_incorreto');
  END IF;
  IF v_nc.status <> 'aguardando_aceite'::public.status_nc THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  v_novo_status := CASE WHEN v_nc.critica THEN 'em_plano_acao'::public.status_nc ELSE 'concluida'::public.status_nc END;
  UPDATE public.nao_conformidades
  SET status = v_novo_status, texto_aceite = p_texto_aceite, aceito_em = v_agora
  WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_colaborador_id, 'aguardando_aceite'::public.status_nc, v_novo_status,
          CASE WHEN v_nc.critica THEN 'Aceite formal do colaborador; NC crítica segue para o plano de ação'
               ELSE 'Aceite formal do colaborador' END,
          v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', v_novo_status);
END;
$$;

-- Conflito de interesses nas decisões da Qualidade: ninguém avalia ou dá feedback na própria NC.
CREATE OR REPLACE FUNCTION public.aplicar_feedback_nc_v3(p_nc_id bigint, p_responsavel_id uuid, p_feedback text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_feedback text := pg_catalog.btrim(coalesce(p_feedback, ''));
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_responsavel_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status NOT IN ('aguardando_feedback'::public.status_nc, 'aguardando_analise'::public.status_nc) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido', 'status_atual', v_nc.status);
  END IF;
  IF v_feedback = '' THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'feedback_ausente'); END IF;
  UPDATE public.nao_conformidades
  SET status = 'aguardando_aceite'::public.status_nc, responsavel_id = p_responsavel_id,
      feedback = v_feedback, feedback_aplicado_em = v_agora
  WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_responsavel_id, v_nc.status, 'aguardando_aceite'::public.status_nc, 'Feedback aplicado', v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', 'aguardando_aceite');
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidar_nc_v3(p_nc_id bigint, p_responsavel_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_nc public.nao_conformidades%ROWTYPE;
  v_agora timestamptz := pg_catalog.now();
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
BEGIN
  SELECT * INTO v_nc FROM public.nao_conformidades WHERE id = p_nc_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada'); END IF;
  IF v_nc.colaborador_id = p_responsavel_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  IF v_nc.status <> 'aberta'::public.status_nc THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'nc_nao_aberta', 'status_atual', v_nc.status);
  END IF;
  IF v_motivo = '' THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'motivo_ausente'); END IF;
  UPDATE public.nao_conformidades
  SET responsavel_id = p_responsavel_id, status = 'invalidada'::public.status_nc,
      motivo_invalidacao = v_motivo, decidido_em = v_agora
  WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_responsavel_id, 'aberta'::public.status_nc, 'invalidada'::public.status_nc, v_motivo, v_agora);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'nc_id', p_nc_id, 'status', 'invalidada');
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_nc_com_workflow_v3(p_nc_id bigint, p_responsavel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_resultado jsonb;
  v_validado_em timestamptz;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.nao_conformidades WHERE id = p_nc_id AND colaborador_id = p_responsavel_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'conflito_interesse');
  END IF;
  v_resultado := public.validar_nc_com_ocorrencias_v2(p_nc_id, p_responsavel_id);
  IF NOT coalesce((v_resultado ->> 'ok')::boolean, false) THEN RETURN v_resultado; END IF;
  SELECT validado_em INTO v_validado_em FROM public.nao_conformidades WHERE id = p_nc_id;
  INSERT INTO public.historico_nc (nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em)
  VALUES (p_nc_id, p_responsavel_id, 'aberta'::public.status_nc, 'aguardando_feedback'::public.status_nc,
          'NC validada e disponibilizada para feedback', coalesce(v_validado_em, pg_catalog.now()));
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.nc_lidera_colaborador(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nc_pode_alimentar_plano(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.definir_nc_critica_v1(bigint, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salvar_plano_acao_v1(bigint, uuid, text, text, text, uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_acompanhamento_plano_v1(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.concluir_plano_acao_v1(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aceitar_nc_v3(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_feedback_nc_v3(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidar_nc_v3(bigint, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_nc_com_workflow_v3(bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nc_lidera_colaborador(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.nc_pode_alimentar_plano(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.definir_nc_critica_v1(bigint, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.salvar_plano_acao_v1(bigint, uuid, text, text, text, uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_acompanhamento_plano_v1(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.concluir_plano_acao_v1(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.aceitar_nc_v3(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_feedback_nc_v3(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidar_nc_v3(bigint, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_nc_com_workflow_v3(bigint, uuid) TO service_role;
