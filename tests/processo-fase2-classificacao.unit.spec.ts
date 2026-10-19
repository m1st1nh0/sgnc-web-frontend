import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { ORIGENS_NC, TIPOS_NC, validarClassificacao } from "../src/lib/nc/classificacao.js";

const read = (path: string) => readFileSync(path, "utf8");
const migracao = read("supabase/migrations/20261014120000_classificacao_na_validacao.sql");
const corpo = (nome: string) => {
  const inicio = migracao.indexOf(`FUNCTION public.${nome}(`);
  return migracao.slice(inicio, migracao.indexOf("$$;", inicio));
};

test("processo 2 (Q6): origem obrigatória, tipo cobrança/orientativa, procedimento e link opcionais", () => {
  expect(Object.keys(ORIGENS_NC)).toEqual(["monitoria", "auditoria", "supervisao", "indicador", "reclamacao"]);
  expect(Object.keys(TIPOS_NC)).toEqual(["cobranca", "orientativa"]);
  expect(validarClassificacao({ tipo_nc: "cobranca" }).erro?.campo).toBe("origem");
  expect(validarClassificacao({ origem: "auditoria", tipo_nc: "outro" }).erro?.campo).toBe("tipo_nc");
  expect(validarClassificacao({ origem: "auditoria", tipo_nc: "cobranca", procedimento_url: "intranet/pop" }).erro?.campo).toBe("procedimento_url");
  expect(validarClassificacao({ origem: "auditoria", tipo_nc: "cobranca", procedimento_url: "javascript:alert(1)" }).erro?.campo).toBe("procedimento_url");
  expect(validarClassificacao({ origem: "monitoria", tipo_nc: "orientativa", procedimento: "  ", procedimento_url: "" }).valor)
    .toEqual({ origem: "monitoria", tipo_nc: "orientativa", procedimento: null, procedimento_url: null });
});

test("processo 2: colunas com CHECK no banco e validação v4 na mesma transação", () => {
  expect(migracao).toContain("ADD COLUMN origem text CHECK (origem IN ('monitoria', 'auditoria', 'supervisao', 'indicador', 'reclamacao'))");
  expect(migracao).toContain("ADD COLUMN tipo_nc text NOT NULL DEFAULT 'cobranca' CHECK (tipo_nc IN ('cobranca', 'orientativa'))");
  expect(migracao).toContain("procedimento_url ~* '^https?://'");
  const v4 = corpo("validar_nc_com_workflow_v4");
  expect(v4).toContain("'origem_invalida'");
  expect(v4).toContain("'conflito_interesse'");
  expect(v4).toContain("FOR UPDATE");
  // Só grava a classificação depois de conferir que a NC pode ser validada.
  expect(v4.indexOf("'nc_nao_aberta'")).toBeLessThan(v4.indexOf("UPDATE public.nao_conformidades"));
  expect(v4).toContain("RETURN public.validar_nc_com_workflow_v3(p_nc_id, p_responsavel_id);");
  expect(migracao).toMatch(/REVOKE ALL ON FUNCTION public\.validar_nc_com_workflow_v4\(.*FROM PUBLIC, anon, authenticated/);
});

test("processo 2: NC orientativa não conta para reincidência nem para medida, nem quando crítica", () => {
  expect(corpo("ocorrencia_no_ciclo")).toContain("AND (nc.id = p_nc_id OR nc.tipo_nc = 'cobranca')");
  const validacao = corpo("validar_nc_com_ocorrencias_v2");
  expect(validacao).toContain("and v_nc.tipo_nc = 'cobranca'");
  expect(validacao).toContain("update public.nc_causas set ocorrencia_numero = null where nc_id = p_nc_id;");
  expect(corpo("medida_para_nc_critica")).toContain("IF v_nc.tipo_nc = 'orientativa' THEN RETURN 0; END IF;");
});

test("processo 2: a API usa a v4 e a tela pede a classificação na validação", () => {
  const servico = read("src/lib/nc/service.ts");
  // Fase 4 do processo: a v5 exige evidência e delega à v4, que grava a classificação.
  expect(servico).toContain('rpcTransition("validar_nc_com_workflow_v5"');
  expect(read("supabase/migrations/20261019140000_feedback_completo.sql"))
    .toContain("RETURN public.validar_nc_com_workflow_v4(p_nc_id, p_responsavel_id, p_origem, p_tipo_nc, p_procedimento, p_procedimento_url);");
  expect(servico).not.toContain('rpcTransition("validar_nc_com_workflow_v3"');
  expect(servico).toContain("validarClassificacao(input)");
  const painel = read("src/features/nc/components/PainelAvaliar.jsx");
  expect(painel).toContain("Origem *");
  expect(painel).toContain("Link do procedimento na intranet (opcional)");
  expect(read("src/features/nc/components/DetalhesNcPage.jsx")).toContain('rel="noopener noreferrer"');
});
