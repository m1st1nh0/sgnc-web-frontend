import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const service = readFileSync("src/lib/nc/service.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261007121000_editar_nc_atomico.sql", "utf8");
const causeIdsBody = service.slice(service.indexOf("async function causeIds"), service.indexOf("async function collaborator"));
const editBody = service.slice(service.indexOf("export async function editarNc"), service.indexOf("export async function excluirNc"));

test("editing an NC keeps archived causes archived in the catalog", () => {
  expect(causeIdsBody).toContain("allowInactive");
  expect(causeIdsBody).not.toMatch(/update\(\{\s*ativo:\s*true\s*\}\)/);
});

test("editing an NC saves the NC and its causes in one transaction", () => {
  expect(editBody).toContain('rpc("editar_nc_v3"');
  expect(editBody).toContain("transitionError(result)");
  expect(editBody).not.toContain('from("nc_causas")');
  expect(migration).toMatch(/FOR UPDATE/);
  expect(migration).toMatch(/IF v_status <> 'aberta'/);
  expect(migration).toMatch(/DELETE FROM public\.nc_causas/);
  expect(migration).toMatch(/FROM PUBLIC, anon, authenticated/);
  expect(migration).toMatch(/TO service_role/);
});
