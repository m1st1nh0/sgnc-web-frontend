-- Fase 2 MANUAL: somente após publicar e validar o novo código em produção.
-- Fora de migrations para não ativar durante preparação/db push.
BEGIN;
DO $$ BEGIN
  IF current_setting('sgnc.novo_codigo_publicado', true) IS DISTINCT FROM 'confirmado' THEN
    RAISE EXCEPTION 'Publique e valide o novo código; depois SET sgnc.novo_codigo_publicado = confirmado na mesma sessão';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.exigir_comprovante_medida()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'aplicada' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.comprovante_caminho IS NULL THEN RAISE EXCEPTION 'Comprovante obrigatório'; END IF;
    ELSIF OLD.status IS DISTINCT FROM 'aplicada' AND NEW.comprovante_caminho IS NULL THEN
      RAISE EXCEPTION 'Comprovante obrigatório';
    END IF;
  END IF;
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
-- Clientes antigos recebem erro de validação em vez de contornar a exigência.
CREATE OR REPLACE FUNCTION public.aplicar_medida_v1(p_medida_id bigint, p_usuario_id uuid, p_data date, p_dias_suspensao integer, p_observacao text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object('ok', false, 'erro', 'anexo_ausente', 'campo', 'arquivo');
$$;
REVOKE ALL ON FUNCTION public.aplicar_medida_v1(bigint, uuid, date, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_medida_v1(bigint, uuid, date, integer, text) TO service_role;
COMMIT;
