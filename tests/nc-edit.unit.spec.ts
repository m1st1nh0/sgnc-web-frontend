import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const service = readFileSync("src/lib/nc/service.ts", "utf8");
const causeIdsBody = service.slice(service.indexOf("async function causeIds"), service.indexOf("async function collaborator"));
const editBody = service.slice(service.indexOf("export async function editarNc"), service.indexOf("export async function excluirNc"));

test("editing an NC keeps archived causes archived in the catalog", () => {
  expect(causeIdsBody).toContain("allowInactive");
  expect(causeIdsBody).not.toMatch(/update\(\{\s*ativo:\s*true\s*\}\)/);
});

test("editing an NC reports failures when its causes are not persisted", () => {
  expect(editBody).toContain("removeCausesError");
  expect(editBody).toContain("insertCausesError");
  expect(editBody).not.toMatch(/^\s*await admin\.from\("nc_causas"\)/m);
});
