-- Relato da NC com imagens no meio do texto.
--
-- A coluna `descricao` passa a guardar, quando o formato for 'html', o texto
-- rico validado por lista de permissão (ver src/lib/nc/texto-rico.js). Os
-- registros antigos continuam como texto puro: o padrão é 'texto', então
-- nada do que já existe muda de leitura.
--
-- As imagens não ficam aqui: continuam na tabela `evidencias` e no bucket
-- `evidencias`, e o texto guarda apenas `<img data-evidencia="id">`.
ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS descricao_formato text NOT NULL DEFAULT 'texto';

ALTER TABLE public.nao_conformidades
  DROP CONSTRAINT IF EXISTS nao_conformidades_descricao_formato_check;
ALTER TABLE public.nao_conformidades
  ADD CONSTRAINT nao_conformidades_descricao_formato_check
  CHECK (descricao_formato IN ('texto', 'html'));

COMMENT ON COLUMN public.nao_conformidades.descricao_formato IS
  'texto = relato em texto puro (registros anteriores); html = texto rico validado, com <img data-evidencia="id">.';

-- Liga a imagem do relato à evidência que a guarda, para a limpeza saber que
-- ela não é um anexo solto da abertura.
ALTER TABLE public.evidencias
  ADD COLUMN IF NOT EXISTS no_relato boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.evidencias.no_relato IS
  'true quando a imagem foi inserida no meio do relato, e não anexada à lista de evidências.';
