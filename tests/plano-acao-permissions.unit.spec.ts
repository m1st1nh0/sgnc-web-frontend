import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { UsuarioAutenticado } from "../src/lib/auth/types";
import { podeExcluirEvidencia } from "../src/lib/permissions/nc";
import {
  podeAlimentarPlano,
  podeAtuarComoQualidade,
  podeConcluirPlano,
  podeDesmarcarCritica,
  podeMarcarCritica,
  podeVerPlano,
} from "../src/lib/permissions/plano-acao";

const pessoa = (id: string, papel: UsuarioAutenticado["papel"]): UsuarioAutenticado => ({
  id, nome: id, email: `${id}@example.invalid`, papel, ativo: true, senha_provisoria: false,
});

const qualidade = pessoa("qualidade", "adm");
const qualidadeAnalisada = pessoa("qualidade-analisada", "adm");
const lider = pessoa("lider", "supervisor");
const liderAnalisado = pessoa("lider-analisado", "supervisor");
const colaborador = pessoa("colaborador", "funcionario");
const autor = pessoa("autor", "funcionario");

const ncValidada = { status: "aguardando_feedback", critica: false, colaborador_id: colaborador.id, aberto_por: autor.id };
const ncCritica = { ...ncValidada, status: "em_plano_acao", critica: true };
const planoEmCurso = { status: "em_execucao", responsavel_execucao_id: lider.id };
const planoAcompanhamento = { status: "em_acompanhamento", responsavel_execucao_id: lider.id };

test("only quality marks an NC as critical, and only after validation", () => {
  expect(podeMarcarCritica(ncValidada, qualidade)).toBe(true);
  expect(podeMarcarCritica({ ...ncValidada, status: "concluida" }, qualidade)).toBe(true);
  expect(podeMarcarCritica({ ...ncValidada, status: "aberta" }, qualidade)).toBe(false);
  expect(podeMarcarCritica({ ...ncValidada, status: "invalidada" }, qualidade)).toBe(false);
  expect(podeMarcarCritica(ncCritica, qualidade)).toBe(false);
  expect(podeMarcarCritica(ncValidada, lider)).toBe(false);
  expect(podeMarcarCritica(ncValidada, colaborador)).toBe(false);
  expect(podeMarcarCritica(ncValidada, autor)).toBe(false);
});

test("the analysed person never acts on their own NC, even holding the quality role", () => {
  const ncDaQualidade = { ...ncValidada, colaborador_id: qualidadeAnalisada.id };
  const criticaDaQualidade = { ...ncCritica, colaborador_id: qualidadeAnalisada.id };
  expect(podeAtuarComoQualidade(ncDaQualidade, qualidadeAnalisada)).toBe(false);
  expect(podeAtuarComoQualidade(ncDaQualidade, qualidade)).toBe(true);
  expect(podeMarcarCritica(ncDaQualidade, qualidadeAnalisada)).toBe(false);
  expect(podeDesmarcarCritica(criticaDaQualidade, planoEmCurso, qualidadeAnalisada)).toBe(false);
  expect(podeAlimentarPlano(criticaDaQualidade, planoEmCurso, qualidadeAnalisada, false)).toBe(false);
  expect(podeConcluirPlano(criticaDaQualidade, planoAcompanhamento, qualidadeAnalisada)).toBe(false);
  expect(podeExcluirEvidencia({ status: "concluida", colaborador_id: qualidadeAnalisada.id }, qualidadeAnalisada)).toBe(false);

  const ncDoLider = { ...ncCritica, colaborador_id: liderAnalisado.id };
  expect(podeAlimentarPlano(ncDoLider, planoEmCurso, liderAnalisado, true)).toBe(false);
});

test("quality and the collaborator's leadership feed the plan; the collaborator only reads it", () => {
  expect(podeAlimentarPlano(ncCritica, planoEmCurso, qualidade, false)).toBe(true);
  expect(podeAlimentarPlano(ncCritica, planoEmCurso, lider, true)).toBe(true);
  expect(podeAlimentarPlano(ncCritica, planoEmCurso, lider, false)).toBe(false);
  expect(podeAlimentarPlano(ncCritica, planoEmCurso, colaborador, false)).toBe(false);
  expect(podeAlimentarPlano(ncCritica, planoEmCurso, autor, false)).toBe(false);
  expect(podeVerPlano(ncCritica, planoEmCurso, colaborador, false)).toBe(true);
  expect(podeVerPlano(ncCritica, planoEmCurso, autor, false)).toBe(false);
  expect(podeVerPlano(ncCritica, planoEmCurso, lider, false)).toBe(true); // responsável pela execução
  expect(podeVerPlano(ncCritica, null, pessoa("outro-lider", "supervisor"), false)).toBe(false);
});

test("closed plans are frozen", () => {
  for (const status of ["concluido", "cancelado"]) {
    expect(podeAlimentarPlano(ncCritica, { status }, qualidade, false)).toBe(false);
  }
  expect(podeDesmarcarCritica(ncCritica, { status: "concluido" }, qualidade)).toBe(false);
  expect(podeAlimentarPlano({ ...ncCritica, critica: false }, planoEmCurso, qualidade, false)).toBe(false);
});

test("only an independent quality member verifies effectiveness", () => {
  expect(podeConcluirPlano(ncCritica, planoAcompanhamento, qualidade)).toBe(true);
  expect(podeConcluirPlano(ncCritica, { ...planoAcompanhamento, responsavel_execucao_id: qualidade.id }, qualidade)).toBe(false);
  expect(podeConcluirPlano(ncCritica, planoAcompanhamento, lider)).toBe(false);
  expect(podeConcluirPlano(ncCritica, planoEmCurso, qualidade)).toBe(false);
  expect(podeConcluirPlano({ ...ncCritica, status: "aguardando_aceite" }, planoAcompanhamento, qualidade)).toBe(false);
});

test("server-side quality actions and SQL functions enforce the conflict of interest", () => {
  const service = readFileSync("src/lib/nc/service.ts", "utf8");
  for (const fn of ["editarNc", "excluirNc", "avaliarNc", "aplicarFeedback"]) {
    const body = service.slice(service.indexOf(`export async function ${fn}`));
    expect(body.slice(0, 200)).toContain("requireQualidadeSemConflito(id)");
  }
  const migration = readFileSync("supabase/migrations/20261008121000_nc_critica_plano_acao.sql", "utf8");
  for (const fn of ["definir_nc_critica_v1", "salvar_plano_acao_v1", "registrar_acompanhamento_plano_v1",
    "concluir_plano_acao_v1", "aplicar_feedback_nc_v3", "invalidar_nc_v3", "validar_nc_com_workflow_v3"]) {
    const body = migration.slice(migration.indexOf(`FUNCTION public.${fn}(`));
    expect(body.slice(0, body.indexOf("$$;"))).toContain("conflito_interesse");
  }
  expect(migration).toContain("planos_acao_verificador_independente");
  expect(migration).toMatch(/GRANT SELECT, INSERT ON TABLE public\.plano_acao_acompanhamentos TO service_role;/);
});
