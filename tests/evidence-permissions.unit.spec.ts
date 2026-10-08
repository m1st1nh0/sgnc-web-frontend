import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { UsuarioAutenticado } from "../src/lib/auth/types";
import { podeAnexarEvidencia, podeExcluirEvidencia } from "../src/lib/permissions/nc";

const pessoa = (id: string, papel: UsuarioAutenticado["papel"]): UsuarioAutenticado => ({
  id, nome: id, email: `${id}@example.invalid`, papel, ativo: true, senha_provisoria: false,
});

const adm = pessoa("adm", "adm");
const autor = pessoa("autor", "funcionario");
const colaborador = pessoa("colaborador", "funcionario");
const supervisor = pessoa("supervisor", "supervisor");
const outro = pessoa("outro", "funcionario");
const ncAberta = { status: "aberta", aberto_por: autor.id, colaborador_id: colaborador.id };

test("evidence upload is limited to quality, author and analysed collaborator while open", () => {
  expect(podeAnexarEvidencia(ncAberta, adm)).toBe(true);
  expect(podeAnexarEvidencia(ncAberta, autor)).toBe(true);
  expect(podeAnexarEvidencia(ncAberta, colaborador)).toBe(true);
  expect(podeAnexarEvidencia(ncAberta, supervisor)).toBe(false);
  expect(podeAnexarEvidencia(ncAberta, outro)).toBe(false);
  expect(podeAnexarEvidencia({ ...ncAberta, status: "aguardando_feedback" }, adm)).toBe(false);
});

test("analysed collaborator and leadership cannot delete the author's evidence", () => {
  expect(podeExcluirEvidencia(ncAberta, colaborador)).toBe(false);
  expect(podeExcluirEvidencia(ncAberta, supervisor)).toBe(false);
  expect(podeExcluirEvidencia(ncAberta, outro)).toBe(false);
  expect(podeExcluirEvidencia(ncAberta, autor)).toBe(true);
  expect(podeExcluirEvidencia({ ...ncAberta, status: "concluida" }, autor)).toBe(false);
  expect(podeExcluirEvidencia({ ...ncAberta, status: "concluida" }, adm)).toBe(true);
});

test("evidence routes enforce the role guards on the server", () => {
  const service = readFileSync("src/lib/nc/evidence.ts", "utf8");
  expect(service).toContain("podeAnexarEvidencia(nc, user)");
  expect(service).toContain("podeExcluirEvidencia(nc, user)");
});
