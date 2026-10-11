import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { caminhoDepartamento, temCicloDepartamento } from "../src/lib/estrutura/departamentos.js";

const departamentos = [
  { id: "intel", nome: "Inteligência", departamento_pai_id: null },
  { id: "qual", nome: "Qualidade", departamento_pai_id: "intel" },
  { id: "trein", nome: "Treinamento", departamento_pai_id: "intel" },
  { id: "suporte", nome: "Suporte", departamento_pai_id: null },
];

test("a department cannot be placed inside itself or one of its sub-areas", () => {
  expect(temCicloDepartamento(departamentos, "intel", "intel")).toBe(true);
  expect(temCicloDepartamento(departamentos, "intel", "qual")).toBe(true);
  expect(temCicloDepartamento(departamentos, "qual", "trein")).toBe(false);
  expect(temCicloDepartamento(departamentos, "suporte", "intel")).toBe(false);
  expect(temCicloDepartamento(departamentos, "suporte", null)).toBe(false);
});

test("the department path goes from the top area down to the department", () => {
  expect(caminhoDepartamento(departamentos, "qual")).toBe("Inteligência › Qualidade");
  expect(caminhoDepartamento(departamentos, "suporte")).toBe("Suporte");
  const ciclico = [{ id: "a", nome: "A", departamento_pai_id: "b" }, { id: "b", nome: "B", departamento_pai_id: "a" }];
  expect(caminhoDepartamento(ciclico, "a")).toBe("B › A");
});

test("departments and positions are managed by Quality/admin and kept in history", () => {
  const migration = readFileSync("supabase/migrations/20261011130000_departamentos_cargos.sql", "utf8");
  expect(migration).toContain("CREATE TABLE public.departamentos");
  expect(migration).toContain("CREATE TABLE public.cargos");
  expect(migration).toContain("ADD COLUMN IF NOT EXISTS departamento_novo uuid");
  expect(migration).toMatch(/departamentos_explicit_deny[\s\S]*USING \(false\)/);
  const service = readFileSync("src/lib/estrutura/service.ts", "utf8");
  expect(service).toContain("if (!ehQualidade(user.papel))");
  expect(service).toContain('from("historico_equipes").insert');
  expect(service).toContain("Mova as pessoas deste departamento antes de desativá-lo.");
});
