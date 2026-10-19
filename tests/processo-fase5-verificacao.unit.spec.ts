import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { etapasDaNc, acaoPendente, infoDoStatus } from "../src/features/nc/client/statusNc.js";
import {
  podeAbrirPlano, podeAlimentarPlano, podeConcluirPlano, podeDecidirEscalonamento, podeDecidirNaoEficaz, podeRegistrarVerificacao,
} from "../src/lib/permissions/plano-acao";
import { temAcessoCompleto } from "../src/lib/permissions/nc";

const read = (path: string) => readFileSync(path, "utf8");
const enumMig = read("supabase/migrations/20261020110000_enum_verificacao_eficacia.sql");
const mig = read("supabase/migrations/20261020120000_verificacao_eficacia.sql");
const corpo = (nome: string) => {
  const inicio = mig.indexOf(`FUNCTION public.${nome}(`);
  return mig.slice(inicio, mig.indexOf("$$;", inicio));
};
const usuario = (id: string, papel: "adm" | "qualidade" | "supervisor" | "funcionario") =>
  ({ id, nome: id, email: `${id}@x`, papel, ativo: true, senha_provisoria: false });
const qualidade = usuario("q1", "qualidade");

test("processo 5 (Q11): valores novos de enum em migração própria", () => {
  for (const valor of ["em_verificacao", "nao_eficaz", "reaberta", "escalada"]) {
    expect(enumMig).toContain(`ADD VALUE IF NOT EXISTS '${valor}'`);
    expect(mig).not.toContain(`ADD VALUE IF NOT EXISTS '${valor}'`);
  }
});

test("processo 5: concluir o plano abre 30 dias de verificação; eficaz conclui, não eficaz exige motivo", () => {
  const concluir = corpo("concluir_plano_acao_v2");
  expect(concluir).toContain("pg_catalog.now() + interval '30 days'");
  expect(concluir).toContain("status = 'em_verificacao'::public.status_nc");
  expect(concluir).toContain("'verificador_executor'");
  const verificacao = corpo("registrar_verificacao_v1");
  expect(verificacao).toContain("p_resultado = 'nao_eficaz' AND (v_obs IS NULL OR length(v_obs) < 10)");
  expect(verificacao).toContain("WHEN p_resultado = 'eficaz' THEN 'concluida'::public.status_nc ELSE 'nao_eficaz'::public.status_nc");
  expect(verificacao).toContain("'conflito_interesse'");
});

test("processo 5: não eficaz → reaberta (nova rodada) ou escalada ao gestor do departamento", () => {
  const decisao = corpo("decidir_nao_eficaz_v1");
  expect(decisao).toContain("ciclo = ciclo + 1");
  expect(decisao).toContain("JOIN public.departamentos AS d ON d.id = c.departamento_id");
  expect(decisao).toContain("'sem_gestor_departamento'");
  expect(decisao).toContain("'gestor_e_colaborador'");
  const parecer = corpo("decidir_escalonamento_v1");
  expect(parecer).toContain("v_nc.escalada_para IS DISTINCT FROM p_usuario_id");
  expect(parecer).toContain("status = 'concluida'::public.status_nc");
});

test("processo 5 (N1): plano em NC não crítica, depois da validação e antes da conclusão", () => {
  const abrir = corpo("abrir_plano_acao_v1");
  expect(abrir).toContain("'aguardando_feedback'::public.status_nc, 'aguardando_analise'::public.status_nc,");
  expect(abrir).toContain("'aguardando_aceite'::public.status_nc, 'nao_respondida'::public.status_nc)");
  expect(mig).toContain("status <> 'em_plano_acao'::public.status_nc OR critica OR plano_acao_aberto");
  expect(corpo("aceitar_nc_v6")).toContain("v_com_plano := v_nc.critica OR v_nc.plano_acao_aberto;");
  const nc = { status: "aguardando_aceite", critica: false, colaborador_id: "c1" };
  expect(podeAbrirPlano(nc, qualidade)).toBe(true);
  expect(podeAbrirPlano({ ...nc, status: "concluida" }, qualidade)).toBe(false);
  expect(podeAbrirPlano({ ...nc, colaborador_id: "q1" }, qualidade)).toBe(false);
  expect(podeAbrirPlano({ ...nc, plano_acao_aberto: true }, qualidade)).toBe(false);
  const plano = { status: "em_acompanhamento", responsavel_execucao_id: "s1" };
  expect(podeAlimentarPlano({ ...nc, plano_acao_aberto: true }, plano, qualidade, false)).toBe(true);
  expect(podeConcluirPlano({ ...nc, status: "reaberta", plano_acao_aberto: true }, plano, qualidade)).toBe(true);
});

test("processo 5: permissões da verificação, da decisão e do parecer", () => {
  const plano = { status: "concluido", responsavel_execucao_id: "s1" };
  const emVerificacao = { status: "em_verificacao", critica: true, colaborador_id: "c1" };
  expect(podeRegistrarVerificacao(emVerificacao, plano, qualidade)).toBe(true);
  expect(podeRegistrarVerificacao(emVerificacao, { ...plano, responsavel_execucao_id: "q1" }, qualidade)).toBe(false);
  expect(podeRegistrarVerificacao({ ...emVerificacao, colaborador_id: "q1" }, plano, qualidade)).toBe(false);
  expect(podeDecidirNaoEficaz({ ...emVerificacao, status: "nao_eficaz" }, qualidade)).toBe(true);
  const escalada = { status: "escalada", colaborador_id: "c1", escalada_para: "g1" };
  expect(podeDecidirEscalonamento(escalada, usuario("g1", "supervisor"))).toBe(true);
  expect(podeDecidirEscalonamento(escalada, qualidade)).toBe(false);
  expect(temAcessoCompleto(escalada, usuario("g1", "supervisor"))).toBe(true);
});

test("processo 5 (N4): desfecho só na avaliação de justa causa, pela Qualidade sem conflito, uma vez", () => {
  const desfecho = corpo("registrar_desfecho_medida_v1");
  expect(desfecho).toContain("v_medida.tipo <> 'avaliar_justa_causa'");
  expect(desfecho).toContain("'desfecho_registrado'");
  expect(desfecho).toContain("'conflito_interesse'");
  expect(mig).toContain("CHECK (desfecho IS NULL OR desfecho IN ('desligado', 'mantido'))");
  expect(read("src/features/nc/components/MedidasPage.jsx")).toContain("Registrar desfecho");
});

test("processo 5: job avisa fim da janela, nova NC da mesma causa e ação do plano vencida (responsável e líder)", () => {
  const job = corpo("verificacao_eficacia_job_v1");
  expect(job).toContain("'fora_do_expediente', true");
  expect(job).toContain("nc.verificacao_ate <= pg_catalog.now()");
  expect(job).toContain("nova.validado_em >= nc.verificacao_inicio");
  expect(job).toContain("public.lideranca_de(v_item.responsavel_execucao_id, false)");
  expect(mig).toContain("cron.schedule('sgnc-verificacao-eficacia'");
  for (const funcao of ["abrir_plano_acao_v1", "aceitar_nc_v6", "concluir_plano_acao_v2", "registrar_verificacao_v1", "decidir_nao_eficaz_v1", "decidir_escalonamento_v1", "registrar_desfecho_medida_v1", "verificacao_eficacia_job_v1", "definir_nc_critica_v3"]) {
    expect(mig).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${funcao}\\(.*FROM PUBLIC, anon, authenticated`));
  }
});

test("processo 5: trilha ganha a etapa de verificação e os status novos têm nome e responsável", () => {
  const chaves = (nc: Record<string, unknown>) => etapasDaNc(nc, "x").map((e: { chave: string; situacao: string }) => `${e.chave}:${e.situacao}`);
  expect(chaves({ status: "em_verificacao", critica: true })).toContain("verificacao:atual");
  expect(chaves({ status: "nao_eficaz", plano_acao_aberto: true })).toContain("verificacao:atrasada");
  expect(chaves({ status: "reaberta", critica: true })).toContain("plano_acao:atual");
  expect(infoDoStatus("escalada").rotulo).toBe("Escalada");
  expect(acaoPendente({ status: "escalada", escalada_para: "g1" }, "g1")?.responsavel).toBe("Você");
  expect(acaoPendente({ status: "nao_eficaz" })?.descricao).toContain("reaberta");
});
