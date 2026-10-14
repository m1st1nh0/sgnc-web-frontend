-- Fase 1 ADITIVA: pode preceder o deploy. A RPC v1 permanece intacta.
-- Obrigatoriedade apenas na RPC v2; anexos presentes têm integridade protegida.
ALTER TABLE public.medidas_disciplinares
  ADD COLUMN comprovante_caminho text,
  ADD COLUMN comprovante_nome text,
  ADD CONSTRAINT medidas_comprovante_par CHECK (
    (comprovante_caminho IS NULL AND comprovante_nome IS NULL) OR
    (comprovante_caminho IS NOT NULL AND comprovante_nome IS NOT NULL
      AND length(btrim(comprovante_nome)) BETWEEN 1 AND 255)
  );
CREATE UNIQUE INDEX medidas_comprovante_unico ON public.medidas_disciplinares(comprovante_caminho)
  WHERE comprovante_caminho IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('medidas-assinadas', 'medidas-assinadas', false, 4194304, ARRAY['image/jpeg', 'image/png', 'image/webp']);
-- Sem políticas para anon/authenticated: uploads e links passam pela API autorizada.

-- Protege anexos presentes sem exigir foto do fluxo legado.
CREATE FUNCTION public.exigir_comprovante_medida()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.comprovante_caminho IS NOT NULL AND
    (NEW.comprovante_caminho IS DISTINCT FROM OLD.comprovante_caminho OR NEW.comprovante_nome IS DISTINCT FROM OLD.comprovante_nome) THEN
    RAISE EXCEPTION 'O comprovante registrado não pode ser substituído ou removido';
  END IF;
  IF NEW.comprovante_caminho IS NOT NULL AND (
    split_part(NEW.comprovante_caminho, '/', 1) <> NEW.id::text OR NOT EXISTS (
      SELECT 1 FROM storage.objects WHERE bucket_id = 'medidas-assinadas' AND name = NEW.comprovante_caminho
    )
  ) THEN RAISE EXCEPTION 'Comprovante não encontrado'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.exigir_comprovante_medida() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER exigir_comprovante_medida BEFORE INSERT OR UPDATE ON public.medidas_disciplinares
FOR EACH ROW EXECUTE FUNCTION public.exigir_comprovante_medida();

CREATE OR REPLACE FUNCTION public.aplicar_medida_com_comprovante_v2(
  p_medida_id bigint,
  p_usuario_id uuid,
  p_data date,
  p_dias_suspensao integer,
  p_observacao text,
  p_comprovante_caminho text,
  p_comprovante_nome text
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
  IF p_data IS NULL OR v_data > v_hoje THEN
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

  IF p_comprovante_caminho IS NULL OR p_comprovante_nome IS NULL
     OR length(btrim(p_comprovante_nome)) NOT BETWEEN 1 AND 255
     OR split_part(p_comprovante_caminho, '/', 1) <> p_medida_id::text
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'medidas-assinadas' AND name = p_comprovante_caminho) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'erro', 'anexo_ausente', 'campo', 'arquivo');
  END IF;

  UPDATE public.medidas_disciplinares
     SET status = 'aplicada', aplicada_por = p_usuario_id, aplicada_em = pg_catalog.now(),
         comprovante_caminho = p_comprovante_caminho, comprovante_nome = p_comprovante_nome,
         data_aplicacao = v_data, dias_suspensao = p_dias_suspensao,
         observacao = coalesce(v_observacao, observacao)
   WHERE id = p_medida_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'medida_id', p_medida_id, 'status', 'aplicada', 'nc_id', v_medida.nc_id);
END;
$$;
REVOKE ALL ON FUNCTION public.aplicar_medida_com_comprovante_v2(bigint, uuid, date, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_medida_com_comprovante_v2(bigint, uuid, date, integer, text, text, text) TO service_role;
