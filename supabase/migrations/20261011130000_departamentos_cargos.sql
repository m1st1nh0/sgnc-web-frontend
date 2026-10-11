-- Estrutura organizacional, Fase B (docs/plano-estrutura-organizacional.md):
-- departamentos (com área-mãe e responsável) e cargos, mantidos pela própria tela (E12).
-- Aditiva: o campo texto usuarios.setor continua existindo e passa a espelhar o nome do
-- departamento, para Insights e Relatórios seguirem funcionando até a troca (E10).

-- 1. Departamentos.
CREATE TABLE public.departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (btrim(nome) <> ''),
  departamento_pai_id uuid REFERENCES public.departamentos(id),
  responsavel_id uuid REFERENCES public.usuarios(id),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (departamento_pai_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX departamentos_nome_unico ON public.departamentos (lower(btrim(nome)));
CREATE INDEX departamentos_pai_idx ON public.departamentos (departamento_pai_id);
CREATE INDEX departamentos_responsavel_idx ON public.departamentos (responsavel_id);

-- 2. Cargos: descrevem a função; o perfil continua sendo a permissão (E13).
CREATE TABLE public.cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (btrim(nome) <> ''),
  departamento_id uuid REFERENCES public.departamentos(id),
  lideranca boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cargos_nome_unico ON public.cargos (lower(btrim(nome)), departamento_id) NULLS NOT DISTINCT;
CREATE INDEX cargos_departamento_idx ON public.cargos (departamento_id);

-- 3. Posição da pessoa.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS departamento_id uuid REFERENCES public.departamentos(id);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cargo_id uuid REFERENCES public.cargos(id);
CREATE INDEX IF NOT EXISTS usuarios_departamento_idx ON public.usuarios (departamento_id);
CREATE INDEX IF NOT EXISTS usuarios_cargo_idx ON public.usuarios (cargo_id);

-- 4. Histórico de equipes também registra mudança de departamento e cargo.
ALTER TABLE public.historico_equipes ADD COLUMN IF NOT EXISTS departamento_anterior uuid;
ALTER TABLE public.historico_equipes ADD COLUMN IF NOT EXISTS departamento_novo uuid;
ALTER TABLE public.historico_equipes ADD COLUMN IF NOT EXISTS cargo_anterior uuid;
ALTER TABLE public.historico_equipes ADD COLUMN IF NOT EXISTS cargo_novo uuid;

-- 5. Conversão dos setores atuais em departamentos (E10).
INSERT INTO public.departamentos (nome)
SELECT DISTINCT ON (lower(btrim(setor))) btrim(setor)
FROM public.usuarios
WHERE setor IS NOT NULL AND btrim(setor) <> ''
ORDER BY lower(btrim(setor)), btrim(setor)
ON CONFLICT DO NOTHING;

-- O setor passa a espelhar exatamente o nome do departamento ("qualidade " vira "Qualidade").
UPDATE public.usuarios u
SET departamento_id = d.id, setor = d.nome
FROM public.departamentos d
WHERE u.departamento_id IS NULL
  AND u.setor IS NOT NULL
  AND lower(btrim(u.setor)) = lower(btrim(d.nome));

-- 6. Acesso só pelo servidor (service role), como as demais tabelas de gestão.
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
CREATE POLICY departamentos_explicit_deny ON public.departamentos
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY cargos_explicit_deny ON public.cargos
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.departamentos, public.cargos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.departamentos, public.cargos TO service_role;
