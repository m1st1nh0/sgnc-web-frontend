import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { ApiError, apiErrorResponse } from "../src/lib/api/error";
import { camposComErro, resumoErros } from "../src/features/nc/client/errosFormulario.js";
import { criarVisaoHome, filtrarNcsPorCardHome } from "../src/features/nc/client/homeUx.js";
import { ehPrimeiroAcesso } from "../src/features/onboarding/onboardingConteudo.js";
import { NOME_PAPEL } from "../src/lib/auth/papeis.js";

const service = readFileSync("src/lib/nc/service.ts", "utf8");
const campoCausas = readFileSync("src/features/nc/components/CampoCausas.jsx", "utf8");
const causasCatalogo = readFileSync("src/lib/nc/causasCatalogo.ts", "utf8");
const causeIdsBody = service.slice(service.indexOf("async function causeIds"), service.indexOf("async function collaborator"));

test("abertura e edição de NC nunca criam causa no catálogo", () => {
  expect(causeIdsBody).not.toContain(".insert(");
  expect(service).not.toContain("allowCreate");
  expect(causeIdsBody).toContain("resolverCausasDoCatalogo(");
  expect(causasCatalogo).not.toContain(".insert(");
  expect(causasCatalogo).toContain('422, "causas"');
  expect(campoCausas).not.toMatch(/permitirCriacaoDireta|Adicionar causa ao catálogo/);
  expect(campoCausas).toContain('href="/causas"');
});

test("erro de negócio informa o campo; erro interno não", async () => {
  const comCampo = await apiErrorResponse(new ApiError("Causa fora do catálogo.", 422, "causas")).json();
  expect(comCampo).toEqual({ detail: "Causa fora do catálogo.", campo: "causas" });
  const semCampo = await apiErrorResponse(new ApiError("Proibido.", 403)).json();
  expect(semCampo).toEqual({ detail: "Proibido." });
  const interno = await apiErrorResponse(new ApiError("detalhe interno", 500, "causas")).json();
  expect(interno.campo).toBeUndefined();
  expect(interno.detail).toBe("Serviço temporariamente indisponível.");
});

test("resumo de erros lista os campos na ordem da tela", () => {
  const erros = { causas: "x", colaborador: "y", descricao: "" };
  expect(camposComErro(erros)).toEqual(["colaborador", "causas"]);
  expect(resumoErros(erros)).toBe("Revise os campos: Colaborador analisado, Causas.");
  expect(resumoErros({ descricao: "z" })).toBe("Revise o campo: Descrição.");
  expect(resumoErros({})).toBe("");
});

test("a próxima ação aplica o filtro de um card existente", () => {
  const ncs = [
    { id: 1, status: "aberta", colaborador_id: "c1", aberto_por: "u9" },
    { id: 2, status: "aguardando_aceite", colaborador_id: "u1", aberto_por: "u9" },
  ];
  const visoes = [
    criarVisaoHome({ id: "q1", papel: "qualidade" }, ncs),
    criarVisaoHome({ id: "s1", papel: "supervisor" }, ncs, ["u1"]),
    criarVisaoHome({ id: "u1", papel: "funcionario" }, ncs),
  ];
  for (const visao of visoes) {
    const { acao } = visao.destaque;
    expect(acao.destino?.startsWith("#")).not.toBe(true);
    if (acao.filtro) {
      expect(visao.cards.map((card) => card.rotulo)).toContain(acao.filtro);
      expect(filtrarNcsPorCardHome(ncs, acao.filtro, "u1").length).toBeGreaterThan(0);
    }
  }
  expect(visoes[0].destaque.acao.filtro).toBe("Aguardando avaliação");
  expect(visoes[2].destaque.acao.filtro).toBe("Aguardando meu aceite");
});

test("primeiros passos ficam abertos só no dia do primeiro acesso", () => {
  const hoje = new Date(2026, 9, 9, 15, 0);
  expect(ehPrimeiroAcesso(null, hoje)).toBe(true);
  expect(ehPrimeiroAcesso({ iniciado_em: null, etapas_concluidas: [] }, hoje)).toBe(true);
  expect(ehPrimeiroAcesso({ iniciado_em: new Date(2026, 9, 9, 8, 0).toISOString() }, hoje)).toBe(true);
  expect(ehPrimeiroAcesso({ iniciado_em: new Date(2026, 9, 8, 8, 0).toISOString() }, hoje)).toBe(false);
  expect(ehPrimeiroAcesso({
    iniciado_em: null,
    etapas_concluidas: [{ concluida_em: new Date(2026, 9, 1).toISOString() }],
  }, hoje)).toBe(false);
});

test("o papel funcionario aparece como Colaborador", () => {
  expect(NOME_PAPEL.funcionario).toBe("Colaborador");
});
