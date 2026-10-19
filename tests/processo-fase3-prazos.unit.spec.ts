import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { acaoPendente, analisePendente, etapasDaNc } from "../src/features/nc/client/statusNc.js";
import { filterSensitive } from "../src/lib/permissions/nc";

const read = (path: string) => readFileSync(path, "utf8");
const migracao = read("supabase/migrations/20261019120000_prazos_analise_feedback_contencao.sql");
const corpo = (nome: string) => {
  const inicio = migracao.indexOf(`FUNCTION public.${nome}(`);
  return migracao.slice(inicio, migracao.indexOf("$$;", inicio));
};

test("processo 3 (Q8/N2): prazos de análise e feedback na validação e na marcação de crítica", () => {
  const prazos = corpo("definir_prazos_etapas");
  expect(prazos).toContain("NEW.prazo_analise := public.somar_horas_expediente(NEW.validado_em, 18);");
  expect(prazos).toContain("NEW.prazo_feedback := public.somar_horas_expediente(NEW.validado_em, 45);");
  expect(prazos).toContain("NEW.prazo_analise := public.fim_do_dia_util(NEW.critica_marcada_em);");
  expect(prazos).toContain("NEW.prazo_feedback := public.somar_horas_expediente(NEW.critica_marcada_em, 9);");
  expect(prazos).toContain("NEW.prazo_contencao := NEW.critica_marcada_em + interval '24 hours';");
  expect(prazos).toContain("NEW.contencao_responsavel_id := NEW.critica_marcada_por;");
  expect(migracao).toContain("CREATE TRIGGER definir_prazos_etapas BEFORE UPDATE OF validado_em, critica ON public.nao_conformidades");
});

test("processo 3: análise de causa antes do feedback, só pela Qualidade sem conflito", () => {
  const analise = corpo("registrar_analise_causa_v1");
  expect(analise).toContain("'sem_permissao'");
  expect(analise).toContain("'conflito_interesse'");
  expect(analise).toContain("FOR UPDATE");
  // Sem troca de status: não dispara a matriz de transições, mas entra na linha do tempo.
  expect(analise).toContain("VALUES (p_nc_id, p_usuario_id, v_nc.status, v_nc.status,");
  const feedback = corpo("registrar_feedback_v5");
  expect(feedback).toContain("v_nc.prazo_analise IS NOT NULL AND v_nc.analise_registrada_em IS NULL");
  expect(feedback).toContain("'analise_pendente'");
});

test("processo 3 (Q9): contenção designada por quem marcou e registrada pelo responsável, nunca pelo colaborador", () => {
  const designar = corpo("designar_contencao_v1");
  expect(designar).toContain("v_nc.critica_marcada_por IS DISTINCT FROM p_usuario_id");
  expect(designar).toContain("p_responsavel_id = v_nc.colaborador_id");
  expect(designar).toContain("'conflito_interesse'");
  const registrar = corpo("registrar_contencao_v1");
  expect(registrar).toContain("v_nc.contencao_responsavel_id IS DISTINCT FROM p_usuario_id");
  expect(registrar).toContain("'conflito_interesse'");
  expect(registrar).toContain("length(v_texto) < 10");
});

test("processo 3 (Q8): vencido o prazo, avisa o responsável e o líder direto dele; job só no expediente", () => {
  const aviso = corpo("notificar_prazo_etapa");
  expect(aviso).toContain("FROM public.lideranca_de(v_resp, false) AS l");
  expect(aviso).toContain("c.u IS DISTINCT FROM p_autor_id");
  const job = corpo("prazos_etapas_v1");
  expect(job).toContain("'fora_do_expediente', true");
  expect(job).toContain("public.somar_horas_expediente(v_agora, 4)");
  expect(migracao).toContain("cron.schedule('sgnc-prazos-etapas'");
  for (const funcao of ["registrar_analise_causa_v1", "registrar_feedback_v5", "designar_contencao_v1", "registrar_contencao_v1", "prazos_etapas_v1"]) {
    expect(migracao).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${funcao}\\(.*FROM PUBLIC, anon, authenticated`));
  }
});

test("processo 3: etapa 'Análise de causa' na trilha, com prazo e atraso", () => {
  const agora = new Date("2026-10-20T15:00:00Z");
  const nc = { status: "aguardando_feedback", prazo_analise: "2026-10-21T13:00:00Z", prazo_feedback: "2026-10-26T13:00:00Z" };
  expect(analisePendente(nc)).toBe(true);
  expect(acaoPendente(nc)?.descricao).toContain("análise de causa");
  const etapas = etapasDaNc(nc, "x", agora);
  expect(etapas.map((e: { chave: string }) => e.chave)).toEqual(["abertura", "avaliacao", "analise", "feedback", "aceite", "concluida"]);
  expect(etapas.find((e: { chave: string }) => e.chave === "analise")).toMatchObject({ situacao: "atual", prazo: nc.prazo_analise, rotulo: "Análise de causa" });
  const atrasada = etapasDaNc(nc, "x", new Date("2026-10-22T12:00:00Z")).find((e: { chave: string }) => e.chave === "analise");
  expect(atrasada).toMatchObject({ situacao: "atrasada", rotulo: "Análise de causa" });
  const feita = etapasDaNc({ ...nc, analise_registrada_em: "2026-10-20T14:00:00Z" }, "x", agora);
  expect(feita.find((e: { chave: string }) => e.chave === "analise")?.situacao).toBe("feita");
  expect(feita.find((e: { chave: string }) => e.chave === "feedback")).toMatchObject({ situacao: "atual", prazo: nc.prazo_feedback });
  // NC validada antes da Fase 3 (sem prazo) segue a trilha antiga.
  expect(etapasDaNc({ status: "aguardando_feedback" }, "x").map((e: { chave: string }) => e.chave)).not.toContain("analise");
});

test("processo 3: análise e contenção ficam fora da visão resumida; servidor usa a v5", () => {
  const resumo = filterSensitive({ analise_causa: "x", contencao_descricao: "y", colaborador_id: "c" }, { id: "outro", papel: "funcionario" } as never);
  expect(resumo.analise_causa).toBeNull();
  expect(resumo.contencao_descricao).toBeNull();
  const prazos = read("src/lib/nc/prazos.ts");
  expect(prazos).toContain('"registrar_analise_causa_v1"');
  expect(prazos).toContain('"designar_contencao_v1"');
  expect(prazos).toContain('"registrar_contencao_v1"');
});
