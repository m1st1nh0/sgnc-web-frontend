-- Edits an open NC and replaces its causes in a single transaction, so a failure
-- can no longer leave the NC saved with missing causes.
CREATE OR REPLACE FUNCTION public.editar_nc_v3(
  p_nc_id bigint,
  p_data date,
  p_chamado text,
  p_setor text,
  p_colaborador text,
  p_colaborador_id uuid,
  p_criticidade text,
  p_descricao text,
  p_setor_responsavel text,
  p_causa_ids bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_status public.status_nc;
BEGIN
  SELECT status INTO v_status
  FROM public.nao_conformidades
  WHERE id = p_nc_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nc_nao_encontrada');
  END IF;
  IF v_status <> 'aberta' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nc_nao_aberta');
  END IF;

  UPDATE public.nao_conformidades
  SET data = coalesce(p_data, data),
      chamado = p_chamado,
      setor = p_setor,
      colaborador = p_colaborador,
      colaborador_id = p_colaborador_id,
      criticidade = p_criticidade,
      reincidencia = 'Não',
      descricao = p_descricao,
      setor_responsavel = p_setor_responsavel
  WHERE id = p_nc_id;

  DELETE FROM public.nc_causas WHERE nc_id = p_nc_id;
  INSERT INTO public.nc_causas (nc_id, causa_id)
  SELECT p_nc_id, causa_id
  FROM (SELECT DISTINCT unnest(coalesce(p_causa_ids, '{}'::bigint[])) AS causa_id) causas;

  RETURN jsonb_build_object('ok', true, 'nc_id', p_nc_id);
END;
$$;

REVOKE ALL ON FUNCTION public.editar_nc_v3(bigint, date, text, text, text, uuid, text, text, text, bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editar_nc_v3(bigint, date, text, text, text, uuid, text, text, text, bigint[]) TO service_role;
