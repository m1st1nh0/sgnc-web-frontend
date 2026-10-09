import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { UsuarioAutenticado } from "../src/lib/auth/types";
import { ehAdminSistema, ehQualidade, podeLiderar } from "../src/lib/auth/papeis";
import { buildNcReadScopeFilter } from "../src/lib/permissions/nc-scope";
import { filterSensitive, temAcessoCompleto } from "../src/lib/permissions/nc";
import { podeMarcarCritica } from "../src/lib/permissions/plano-acao";

const pessoa = (id: string, papel: UsuarioAutenticado["papel"]): UsuarioAutenticado => ({
  id, nome: id, email: `${id}@example.invalid`, papel, ativo: true, senha_provisoria: false,
});

const admin = pessoa("admin", "adm");
const qualidade = pessoa("qualidade", "qualidade");
const supervisor = pessoa("supervisor", "supervisor");

test("system administrator also exercises quality; quality does not manage users", () => {
  expect(ehQualidade("adm")).toBe(true);
  expect(ehQualidade("qualidade")).toBe(true);
  expect(ehQualidade("supervisor")).toBe(false);
  expect(ehAdminSistema("adm")).toBe(true);
  expect(ehAdminSistema("qualidade")).toBe(false);
  expect(podeLiderar("qualidade")).toBe(true);
  expect(podeLiderar("funcionario")).toBe(false);
  expect(buildNcReadScopeFilter(qualidade, [])).toBeNull();
  const nc = { status: "aguardando_feedback", critica: false, colaborador_id: "colaborador", aberto_por: "autor" };
  expect(podeMarcarCritica(nc, qualidade)).toBe(true);
  expect(podeMarcarCritica(nc, admin)).toBe(true);
});

test("a supervisor only gets full NC details for their own team", () => {
  const daEquipe = { aberto_por: supervisor.id, colaborador_id: "liderado", feedback: "combinado", motivo_invalidacao: null };
  const foraDaEquipe = { aberto_por: supervisor.id, colaborador_id: "outra-equipe", feedback: "combinado", motivo_invalidacao: "x" };
  const equipe = new Set(["liderado"]);
  expect(temAcessoCompleto(daEquipe, supervisor, equipe)).toBe(true);
  expect(temAcessoCompleto(foraDaEquipe, supervisor, equipe)).toBe(false);
  expect(filterSensitive(foraDaEquipe, supervisor, equipe)).toMatchObject({ feedback: null, motivo_invalidacao: null, acesso_completo: false });
  expect(filterSensitive(daEquipe, supervisor, equipe)).toMatchObject({ feedback: "combinado", acesso_completo: true });
  expect(temAcessoCompleto(foraDaEquipe, qualidade)).toBe(true);
});

test("user management stays with the system administrator and teams are audited", () => {
  const usuarios = readFileSync("src/lib/usuarios/service.ts", "utf8");
  expect(usuarios).toContain("if (!ehAdminSistema(user.papel))");
  expect(usuarios).toContain("Você não pode remover o seu próprio perfil de administrador.");
  expect(usuarios).toContain("registrarHistoricoEquipe(");
  const equipes = readFileSync("src/lib/equipes/service.ts", "utf8");
  expect(equipes).toContain("if (!ehQualidade(user.papel))");
  expect(equipes).toContain('rpc("alterar_equipe_v1"');
  const migration = readFileSync("supabase/migrations/20261008122000_papel_qualidade_equipes.sql", "utf8");
  expect(migration).toMatch(/GRANT SELECT, INSERT ON TABLE public\.historico_equipes TO service_role;/);
  expect(migration).toContain("'ciclo'");
  expect(migration).toContain("'possui_liderados'");
  expect(migration).toContain("'papel_fora_das_equipes'");
  const usuariosPage = readFileSync("src/app/(app)/usuarios/page.tsx", "utf8");
  expect(usuariosPage).toContain('requireRole(["adm"])');
});
