import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { ApiError } from "../src/lib/api/error";
import { erroDoFeedback, hojeEmSaoPaulo, validarFeedback } from "../src/lib/nc/feedback";
import { STATUS_CONTAM_OCORRENCIA, inicioJanelaReincidencia, montarAnteriores, situacaoDoAceite } from "../src/lib/nc/reincidencia";
import { podeAnexarAoFeedback, filterSensitive } from "../src/lib/permissions/nc";
import { STATUS_PERMITEM_MARCAR_CRITICA } from "../src/lib/permissions/plano-acao";
import { SUPERVISOR_VISIBLE_NC_STATUSES } from "../src/lib/permissions/nc-scope";
import { acaoPendente, etapasDaNc, infoDoStatus } from "../src/features/nc/client/statusNc.js";
import { criarVisaoHome, filtrarNcsPorCardHome } from "../src/features/nc/client/homeUx.js";
import { formatarPrazo } from "../src/lib/utils/formato.js";

const read = (path: string) => readFileSync(path, "utf8");
const migracao = read("supabase/migrations/20261010121000_feedback_estruturado_aceite_prazo.sql");
const quarta = new Date("2026-10-14T15:00:00Z"); // quarta, 12h em São Paulo
const valido = {
  causa_raiz: "Pulou a conferência",
  acao_combinada: "Conferir antes de enviar",
  responsavel_acao_id: "00000000-0000-4000-8000-000000000001",
  prazo_acao: "2026-10-20",
  combinado: "Revisar o checklist toda manhã",
};
const usuario = (id: string, papel: "adm" | "qualidade" | "supervisor" | "funcionario") =>
  ({ id, nome: id, email: `${id}@x`, papel, ativo: true, senha_provisoria: false });

function campoDoErro(fn: () => unknown) {
  try { fn(); } catch (error) { return { status: (error as ApiError).status, campo: (error as ApiError).campo, mensagem: (error as ApiError).message }; }
  return null;
}

test("4.16: feedback exige os cinco campos e aponta o primeiro que falta", () => {
  expect(validarFeedback(valido, quarta)).toEqual(valido);
  for (const [campo, chave] of [["causa_raiz", "causa_raiz"], ["acao_combinada", "acao_combinada"], ["responsavel_acao_id", "responsavel_acao"], ["prazo_acao", "prazo_acao"], ["combinado", "combinado"]] as const) {
    const erro = campoDoErro(() => validarFeedback({ ...valido, [campo]: "   " }, quarta));
    expect(erro).toMatchObject({ status: 422, campo: chave });
  }
  expect(campoDoErro(() => validarFeedback({}, quarta))?.campo).toBe("causa_raiz");
});

test("4.16: prazo da ação não pode ser anterior a hoje (data de São Paulo) e responsável deve ser válido", () => {
  expect(campoDoErro(() => validarFeedback({ ...valido, prazo_acao: "2026-10-13" }, quarta))).toMatchObject({ campo: "prazo_acao", mensagem: "O prazo da ação não pode ser anterior a hoje." });
  expect(validarFeedback({ ...valido, prazo_acao: "2026-10-14" }, quarta).prazo_acao).toBe("2026-10-14");
  expect(campoDoErro(() => validarFeedback({ ...valido, prazo_acao: "2026-02-30" }, quarta))?.campo).toBe("prazo_acao");
  expect(campoDoErro(() => validarFeedback({ ...valido, responsavel_acao_id: "x" }, quarta))?.campo).toBe("responsavel_acao");
  // 23h de terça em São Paulo já é quarta em UTC: o "hoje" segue o fuso da operação.
  expect(hojeEmSaoPaulo(new Date("2026-10-14T02:00:00Z"))).toBe("2026-10-13");
});

test("4.10: códigos da RPC viram erro com campo para a interface", () => {
  expect(erroDoFeedback({ erro: "campo_obrigatorio", campo: "combinado" })).toMatchObject({ status: 422, campo: "combinado" });
  expect(erroDoFeedback({ erro: "prazo_invalido" })).toMatchObject({ campo: "prazo_acao" });
  expect(erroDoFeedback({ erro: "responsavel_invalido" })).toMatchObject({ campo: "responsavel_acao" });
  expect(erroDoFeedback({ erro: "status_invalido" })).toBeNull();
  const service = read("src/lib/nc/service.ts");
  expect(service).toContain("erroDoFeedback(result)");
  expect(service).toContain('rpcTransition("registrar_feedback_v4"');
  expect(service).toContain('rpcTransition("aceitar_nc_v4"');
  expect(service).not.toContain("aplicar_feedback_nc_v3");
});

test("4.3/4.16: prazo de 18 horas de expediente segue os exemplos do plano (função do banco)", () => {
  // A função roda no Postgres; os casos foram conferidos no banco local e no Supabase.
  expect(migracao).toContain("somar_horas_expediente(v_agora, 18)");
  expect(migracao).toContain("'America/Sao_Paulo'");
  expect(migracao).toMatch(/date_part\('isodow', v_local\) IN \(6, 7\)/);
  expect(migracao).toContain("time '09:00'");
  expect(migracao).toContain("time '18:00'");
  expect(formatarPrazo("2026-10-14T17:00:00Z")).toBe("qua, 14/10 às 14:00");
  expect(formatarPrazo("2026-10-20T21:00:00Z")).toBe("ter, 20/10 às 18:00");
});

test("4.5/4.5b: job idempotente, aceite tardio marcado fora do prazo e RPCs só para o servidor", () => {
  expect(migracao).toContain("FOR UPDATE OF nc SKIP LOCKED");
  expect(migracao).toContain("'Prazo de aceite vencido sem resposta'");
  expect(migracao).toMatch(/v_fora_prazo := v_nc.status = 'nao_respondida'::public.status_nc OR/);
  expect(migracao).toContain("'Aceite formal do colaborador fora do prazo'");
  for (const funcao of ["registrar_feedback_v4", "marcar_nao_respondidas_v1", "aceitar_nc_v4", "definir_nc_critica_v2"]) {
    expect(migracao).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${funcao}\\(.*FROM PUBLIC, anon, authenticated`));
  }
  expect(migracao).toContain("REVOKE ALL ON TABLE public.nc_feedbacks FROM PUBLIC, anon, authenticated");
  expect(read("supabase/migrations/20261010122000_agendamento_nao_respondidas.sql")).toContain("'*/15 * * * *'");
  expect(read("supabase/migrations/20261010120000_enum_nao_respondida.sql").trim().split("\n").filter((linha) => !linha.startsWith("--"))).toEqual([
    "ALTER TYPE public.status_nc ADD VALUE IF NOT EXISTS 'nao_respondida';",
  ]);
});

test("4.6: backfill não inventa causa raiz", () => {
  expect(migracao).toContain("'Não informado (registro anterior a 10/2026)'");
  expect(migracao).toMatch(/nc\.feedback,\s*\n\s*public\.somar_horas_expediente\(coalesce\(nc\.feedback_aplicado_em/);
});

test("4.5c/D14: Não respondida e Em plano de ação contam para reincidência, no banco e no servidor", () => {
  expect([...STATUS_CONTAM_OCORRENCIA]).toEqual(["validada", "aguardando_analise", "aguardando_feedback", "aguardando_aceite", "nao_respondida", "em_plano_acao", "concluida"]);
  const lista = migracao.slice(migracao.indexOf("and anterior.status in ("), migracao.indexOf("and anterior.data >="));
  for (const status of STATUS_CONTAM_OCORRENCIA) expect(lista).toContain(`'${status}'::public.status_nc`);
  expect(lista).not.toContain("'aberta'");
  expect(lista).not.toContain("'invalidada'");
});

test("4.5c: Não respondida continua visível para colaborador e liderança e pode ser marcada como crítica", () => {
  expect(SUPERVISOR_VISIBLE_NC_STATUSES).toContain("nao_respondida");
  expect(STATUS_PERMITEM_MARCAR_CRITICA).toContain("nao_respondida");
  expect(read("src/lib/nc/plano-acao.ts")).toContain('"definir_nc_critica_v2"');
  expect(read("src/lib/nc/service.ts")).toContain('"aguardando_aceite", "nao_respondida", "em_plano_acao"');
});

test("4.9: janela de 12 meses igual ao Postgres e NCs anteriores com o que foi combinado", () => {
  expect(inicioJanelaReincidencia("2026-10-10")).toBe("2025-10-10");
  expect(inicioJanelaReincidencia("2024-02-29")).toBe("2023-02-28");
  const anteriores = montarAnteriores(
    [
      { id: 5, data: "2026-03-01", status: "concluida", aceito_em: "2026-03-03T12:00:00Z", aceito_fora_prazo: false },
      { id: 7, data: "2026-06-01", status: "nao_respondida" },
      { id: 9, data: "2026-06-01", status: "concluida", aceito_em: "2026-06-05T12:00:00Z", aceito_fora_prazo: true },
      { id: 11, data: "2026-07-01", status: "concluida" },
    ],
    [{ nc_id: 5, causa_id: 1 }, { nc_id: 7, causa_id: 1 }, { nc_id: 7, causa_id: 2 }, { nc_id: 9, causa_id: 2 }, { nc_id: 11, causa_id: 99 }],
    [
      { nc_id: 5, versao: 1, causa_raiz: "antiga", acao_combinada: "a1" },
      { nc_id: 5, versao: 2, causa_raiz: "revisada", acao_combinada: "a2" },
    ],
    new Map([[1, "Falha A"], [2, "Falha B"]]),
  );
  expect(anteriores.map((item) => item.id)).toEqual([9, 7, 5]);
  expect(anteriores.find((item) => item.id === 7)?.causas).toEqual(["Falha A", "Falha B"]);
  expect(anteriores.find((item) => item.id === 5)).toMatchObject({ causa_raiz: "revisada", acao_combinada: "a2", aceite: "no_prazo" });
  expect(anteriores.find((item) => item.id === 9)?.aceite).toBe("fora_prazo");
  expect(anteriores.find((item) => item.id === 7)?.aceite).toBe("nao_respondida");
  expect(situacaoDoAceite({ status: "aguardando_aceite" })).toBe("aguardando");
});

test("4.9: rota de reincidência exige acesso completo", () => {
  const service = read("src/lib/nc/service.ts");
  const corpo = service.slice(service.indexOf("export async function obterContextoReincidencia"));
  expect(corpo).toContain("nc.acesso_completo !== true");
  expect(corpo).toContain("403");
  expect(read("src/app/api/nc/[ncId]/reincidencia/route.ts")).toContain("obterContextoReincidencia");
});

test("4.8: anexo do feedback só para quem registrou, da mesma NC, logo após o registro", () => {
  const qualidade = usuario("q1", "qualidade");
  const nc = { id: 10, status: "aguardando_aceite", colaborador_id: "c1" };
  const feedback = { nc_id: 10, registrado_por: "q1" };
  expect(podeAnexarAoFeedback(nc, feedback, qualidade)).toBe(true);
  expect(podeAnexarAoFeedback(nc, { ...feedback, nc_id: 11 }, qualidade)).toBe(false);
  expect(podeAnexarAoFeedback(nc, { ...feedback, registrado_por: "q2" }, qualidade)).toBe(false);
  expect(podeAnexarAoFeedback(nc, null, qualidade)).toBe(false);
  expect(podeAnexarAoFeedback({ ...nc, status: "concluida" }, feedback, qualidade)).toBe(false);
  expect(podeAnexarAoFeedback({ ...nc, colaborador_id: "q1" }, feedback, qualidade)).toBe(false);
  expect(podeAnexarAoFeedback(nc, { ...feedback, registrado_por: "s1" }, usuario("s1", "supervisor"))).toBe(false);
});

test("4.7: feedback estruturado e aceite fora do prazo ficam ocultos para acesso restrito", () => {
  const restrito = filterSensitive({ id: 1, colaborador_id: "c1", aceito_fora_prazo: true, feedback: "x" }, usuario("f9", "funcionario"));
  expect(restrito).toMatchObject({ acesso_completo: false, aceito_fora_prazo: null, feedback: null });
  const service = read("src/lib/nc/service.ts");
  expect(service).toContain("filtered.acesso_completo === true && data.feedback_aplicado_em");
});

test("4.12–4.14: telas de status, etapas, aceite e painel tratam Não respondida", () => {
  expect(infoDoStatus("nao_respondida")).toMatchObject({ rotulo: "Não respondida", cor: "danger" });
  const prazo = "2026-10-14T17:00:00Z";
  const vencida = { status: "nao_respondida", colaborador: "Ana", colaborador_id: "c1", feedback_estruturado: { prazo_aceite: prazo } };
  const etapa = etapasDaNc(vencida, "c1").find((item: { chave: string }) => item.chave === "aceite");
  expect(etapa).toMatchObject({ situacao: "atrasada", rotulo: "Não respondida", responsavel: "Você", prazo });
  expect(etapasDaNc({ ...vencida, status: "aguardando_aceite" }, "x").find((item: { chave: string }) => item.chave === "aceite")).toMatchObject({ situacao: "atual", prazo, responsavel: "Ana" });
  expect(acaoPendente(vencida, "c1")?.descricao).toContain("fora do prazo");

  const ncs = [
    { id: 1, status: "nao_respondida", colaborador_id: "c1" },
    { id: 2, status: "aguardando_aceite", colaborador_id: "c1" },
    { id: 3, status: "concluida", colaborador_id: "c1" },
  ];
  const qualidade = criarVisaoHome(usuario("q1", "qualidade"), ncs);
  expect(qualidade.cards.find((card: { rotulo: string }) => card.rotulo === "Não respondidas")?.valor).toBe(1);
  expect(filtrarNcsPorCardHome(ncs, "Não respondidas", "q1").map((nc: { id: number }) => nc.id)).toEqual([1]);
  const supervisor = criarVisaoHome(usuario("s1", "supervisor"), ncs, ["c1"]);
  expect(supervisor.cards.find((card: { rotulo: string }) => card.rotulo === "Não respondidas")?.valor).toBe(1);
  const colaborador = criarVisaoHome(usuario("c1", "funcionario"), ncs);
  expect(colaborador.cards.find((card: { rotulo: string }) => card.rotulo === "Aguardando meu aceite")?.valor).toBe(2);
  expect(filtrarNcsPorCardHome(ncs, "Aguardando meu aceite", "c1").map((nc: { id: number }) => nc.id)).toEqual([1, 2]);

  const detalhe = read("src/features/nc/components/DetalhesNcPage.jsx");
  expect(detalhe).toContain('["aguardando_aceite", "nao_respondida"].includes(nc.status)');
  expect(detalhe).toContain("<FeedbackNc");
  expect(read("src/features/nc/components/PainelAceite.jsx")).toContain("O aceite ainda pode ser");
  const painel = read("src/features/nc/components/PainelFeedback.jsx");
  expect(painel).toContain("o colaborador terá 2 dias úteis para registrar o aceite");
  expect(painel).toContain("anexarEvidencia(nc.id, arquivo, atualizada.feedback_id)");
  expect(painel).toContain("Histórico deste colaborador com esta causa");
});

test("4.14/4.15: Insights e relatórios trazem Não respondidas, aceite no prazo e feedback estruturado", () => {
  const analytics = read("src/lib/analytics/service.ts");
  expect(analytics).toContain("nao_respondidas_atual");
  expect(analytics).toContain("taxa_aceite_no_prazo");
  expect(analytics).toContain("if(nc.status==='nao_respondida')si.nao_respondidas++");
  const reports = read("src/lib/reports/service.ts");
  expect(reports).toContain('"Causa raiz","Acao combinada","Responsavel pela acao","Prazo da acao","Combinado","Prazo do aceite","Situacao do aceite"');
  expect(reports).toContain('writer.line("Situacao do aceite"');
  expect(reports).toContain('writer.line("Taxa de aceite no prazo"');
});
