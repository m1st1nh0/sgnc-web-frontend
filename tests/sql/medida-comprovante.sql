-- Executar após a preparação aditiva dentro de BEGIN/ROLLBACK. Nenhum dado de negócio é persistido.
DO $$
DECLARE
  m public.medidas_disciplinares%ROWTYPE;
  operador uuid;
  resultado jsonb;
  caminho text;
BEGIN
  SELECT * INTO m FROM public.medidas_disciplinares WHERE status = 'sugerida' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fixture requer uma medida sugerida'; END IF;
  SELECT id INTO operador FROM public.usuarios WHERE ativo AND papel IN ('adm','qualidade') AND id <> m.colaborador_id LIMIT 1;
  IF operador IS NULL THEN RAISE EXCEPTION 'Fixture requer operador'; END IF;
  resultado := public.decidir_medida_v1(m.id, operador, 'aprovar', NULL, NULL);
  IF NOT (resultado->>'ok')::boolean THEN RAISE EXCEPTION 'Aprovação falhou: %', resultado; END IF;
  resultado := public.aplicar_medida_com_comprovante_v2(m.id, operador, CURRENT_DATE, CASE WHEN m.tipo='suspensao' THEN 1 ELSE NULL END, NULL, NULL, NULL);
  IF resultado->>'erro' IS DISTINCT FROM 'anexo_ausente' THEN RAISE EXCEPTION 'Ausência não bloqueada: %', resultado; END IF;
  -- A exceção desfaz somente a aplicação legada, sem alterar o fixture aprovado.
  BEGIN
    resultado := public.aplicar_medida_v1(m.id, operador, CURRENT_DATE, CASE WHEN m.tipo='suspensao' THEN 1 ELSE NULL END, NULL);
    IF (resultado->>'ok') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Legado bloqueado: %', resultado; END IF;
    UPDATE public.medidas_disciplinares SET observacao='Histórico legado continua editável' WHERE id=m.id;
    RAISE EXCEPTION 'rollback_fixture_legado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_fixture_legado' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.medidas_disciplinares WHERE id=m.id) <> 'aprovada' THEN RAISE EXCEPTION 'Falha alterou status'; END IF;
  resultado := public.aplicar_medida_com_comprovante_v2(m.id, m.colaborador_id, CURRENT_DATE, NULL, NULL, NULL, NULL);
  IF resultado->>'erro' NOT IN ('conflito_interesse','sem_permissao') THEN RAISE EXCEPTION 'Segregação falhou'; END IF;
  caminho := m.id::text || '/fixture-transacional.jpg';
  resultado := public.aplicar_medida_com_comprovante_v2(m.id, operador, CURRENT_DATE, CASE WHEN m.tipo='suspensao' THEN 1 ELSE NULL END, NULL, caminho, 'foto.jpg');
  IF resultado->>'erro' IS DISTINCT FROM 'anexo_ausente' THEN RAISE EXCEPTION 'Objeto inexistente não bloqueado'; END IF;
  -- Apenas metadado de teste, desfeito ao final: não representa um upload real.
  INSERT INTO storage.objects (bucket_id, name) VALUES ('medidas-assinadas', caminho);
  resultado := public.aplicar_medida_com_comprovante_v2(m.id, operador, CURRENT_DATE, CASE WHEN m.tipo='suspensao' THEN 1 ELSE NULL END, 'Teste transacional', caminho, 'foto.jpg');
  IF NOT (resultado->>'ok')::boolean THEN RAISE EXCEPTION 'Registro falhou: %', resultado; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.medidas_disciplinares WHERE id=m.id AND status='aplicada' AND comprovante_caminho=caminho AND aplicada_por=operador) THEN RAISE EXCEPTION 'Registro incompleto'; END IF;
  resultado := public.aplicar_medida_com_comprovante_v2(m.id, operador, CURRENT_DATE, NULL, NULL, caminho, 'foto.jpg');
  IF resultado->>'erro' IS DISTINCT FROM 'status_invalido' THEN RAISE EXCEPTION 'Reenvio não bloqueado'; END IF;
  BEGIN
    UPDATE public.medidas_disciplinares SET comprovante_caminho=NULL, comprovante_nome=NULL WHERE id=m.id;
    RAISE EXCEPTION 'Teste falhou: comprovante removido';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'O comprovante registrado não pode ser substituído ou removido' THEN RAISE; END IF;
  END;
  IF has_function_privilege('anon','public.aplicar_medida_com_comprovante_v2(bigint,uuid,date,integer,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC exposta para anon'; END IF;
  IF NOT has_function_privilege('service_role','public.aplicar_medida_com_comprovante_v2(bigint,uuid,date,integer,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Servidor sem acesso à RPC'; END IF;
  IF has_function_privilege('authenticated','public.aplicar_medida_com_comprovante_v2(bigint,uuid,date,integer,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC exposta'; END IF;
END;
$$;
SELECT 'OK: ausência, legado, objeto inexistente, permissão, registro atômico, reenvio e imutabilidade' AS verificacao;
