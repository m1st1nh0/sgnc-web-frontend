import { test, expect } from "@playwright/test";
import { comRetorno, normalizarRetorno, rotuloRetorno, urlComFiltros } from "../src/lib/utils/retorno.js";

test("retorno aceita apenas listas internas conhecidas", () => {
  expect(normalizarRetorno("/relatorios?inicio=2026-01-01&pagina=1")).toBe("/relatorios?inicio=2026-01-01&pagina=1");
  expect(normalizarRetorno("/equipe/abc?status=aberta")).toBe("/equipe/abc?status=aberta");
  expect(normalizarRetorno("/insights")).toBe("/insights");
  expect(normalizarRetorno(["/minhas-ncs", "/x"])).toBe("/minhas-ncs");
  for (const invalido of ["https://evil.com", "//evil.com", "/\\evil.com", "/relatorios-falso", "/nc/1", "", undefined]) {
    expect(normalizarRetorno(invalido)).toBe("/");
  }
});

test("rótulo e montagem de URLs de retorno", () => {
  expect(rotuloRetorno("/equipe/abc?status=aberta")).toBe("Voltar para as NCs da pessoa");
  expect(rotuloRetorno("/")).toBe("Voltar para a lista");
  expect(urlComFiltros("/relatorios", { inicio: "2026-01-01", status: "", pagina: 0 })).toBe("/relatorios?inicio=2026-01-01");
  expect(comRetorno("/nc/7", "/relatorios?pagina=1")).toBe("/nc/7?retorno=%2Frelatorios%3Fpagina%3D1");
});
