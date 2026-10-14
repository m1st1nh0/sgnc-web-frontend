import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { comparacao, diasNaEtapa, itensDeAtencao, ordenarParaAcao, periodoAnterior } from "../src/lib/reports/regras";
import { escreverResumo } from "../src/lib/reports/resumo-pdf";

// Terça, 13/10/2026 às 14:30 em Brasília.
const agora = new Date("2026-10-13T17:30:00Z");

test("R2: período anterior tem o mesmo número de dias e termina na véspera", () => {
  expect(periodoAnterior("2026-09-14", "2026-10-13")).toEqual({ inicio: "2026-08-15", fim: "2026-09-13", dias: 30 });
  expect(periodoAnterior("2026-10-01", "2026-10-01")).toEqual({ inicio: "2026-09-30", fim: "2026-09-30", dias: 1 });
  expect(periodoAnterior("2026-03-01", "2026-03-31")).toEqual({ inicio: "2026-01-29", fim: "2026-02-28", dias: 31 });
});

test("R2: comparação com o período anterior", () => {
  expect(comparacao(4, 2)).toBe("anterior: 2 (+2)");
  expect(comparacao(1, 3)).toBe("anterior: 3 (-2)");
  expect(comparacao(5, 5)).toBe("anterior: 5 (igual)");
  expect(comparacao(1, 0.8, "percentual")).toBe("anterior: 80% (+20 p.p.)");
  expect(comparacao(1, null, "percentual")).toBe("anterior: sem aceites");
  expect(comparacao(null, 0.5, "percentual")).toBe("anterior: 50%");
});

test("R2: dias na etapa contam a partir da entrada na etapa atual", () => {
  expect(diasNaEtapa({ status: "aguardando_feedback", criado_em: "2026-10-01T12:00:00Z", validado_em: "2026-10-10T14:54:34Z" }, agora)).toBe(3);
  expect(diasNaEtapa({ status: "aguardando_aceite", criado_em: "2026-10-01T12:00:00Z", validado_em: "2026-10-02T12:00:00Z", feedback_aplicado_em: "2026-10-12T12:00:00Z" }, agora)).toBe(1);
  expect(diasNaEtapa({ status: "concluida", criado_em: "2026-10-01T12:00:00Z" }, agora)).toBeNull();
});

test("R2: lista põe o que pede ação primeiro", () => {
  const ncs = [{ id: 5, status: "concluida", data: "2026-10-10" }, { id: 12, status: "aguardando_feedback", data: "2026-10-10" }, { id: 11, status: "aguardando_aceite", data: "2026-10-10" }, { id: 9, status: "nao_respondida", data: "2026-10-01" }];
  expect(ncs.sort(ordenarParaAcao).map((nc) => nc.id)).toEqual([9, 11, 12, 5]);
});

const ativas = [
  { id: 12, status: "aguardando_feedback", criado_em: "2026-10-10T14:54:29Z", validado_em: "2026-10-10T14:54:34Z", critica: false },
  { id: 11, status: "aguardando_aceite", criado_em: "2026-10-10T14:53:17Z", validado_em: "2026-10-10T14:53:27Z", feedback_aplicado_em: "2026-10-10T14:53:48Z", prazo_aceite: "2026-10-13T21:00:00+00:00" },
  { id: 10, status: "aguardando_aceite", criado_em: "2026-10-10T14:52:31Z", validado_em: "2026-10-10T14:52:37Z", feedback_aplicado_em: "2026-10-10T14:52:59Z", prazo_aceite: "2026-10-13T21:00:00+00:00" },
];
const medidas = [{ nc_id: 12, tipo: "advertencia", status: "sugerida", ocorrencia_gatilho: 4, causa: "Apontamento de horas incoerente" }];

test("R2: Pede atenção com os dados de 13/10/2026", () => {
  const itens = itensDeAtencao({ ativas, medidas, agora });
  expect(itens.map((item) => item.rotulo)).toEqual(["Vence hoje", "Reincidência", "Parada"]);
  expect(itens[0]).toMatchObject({ nivel: "critico", ncs: [10, 11], texto: "2 aceites vencem hoje às 18:00. Sem aceite, as NCs passam para Não respondida." });
  expect(itens[1].texto).toBe('4ª ocorrência de "Apontamento de horas incoerente" com o mesmo colaborador. Advertência sugerida, aguardando decisão da Qualidade.');
  expect(itens[2]).toMatchObject({ nivel: "info", ncs: [12], texto: "Aguardando feedback há 3 dias. É a NC há mais tempo na mesma etapa." });
});

test("R2: Pede atenção cobre prazo vencido, amanhã, não respondida e crítica", () => {
  const itens = itensDeAtencao({
    agora,
    ativas: [
      { id: 1, status: "aguardando_aceite", prazo_aceite: "2026-10-13T12:00:00Z", feedback_aplicado_em: "2026-10-09T12:00:00Z" },
      { id: 2, status: "aguardando_aceite", prazo_aceite: "2026-10-14T15:00:00Z", feedback_aplicado_em: "2026-10-12T15:00:00Z" },
      { id: 3, status: "nao_respondida", feedback_aplicado_em: "2026-10-08T12:00:00Z" },
      { id: 4, status: "em_plano_acao", critica: true, aceito_em: "2026-10-09T12:00:00Z" },
    ],
  });
  expect(itens.map((item) => item.rotulo)).toEqual(["Prazo vencido", "Sem aceite", "Crítica", "Vence amanhã", "Parada"]);
  expect(itens.find((item) => item.rotulo === "Vence amanhã")?.texto).toBe("1 aceite vence amanhã às 12:00. Sem aceite, a NC passa para Não respondida.");
  expect(itens.at(-1)).toMatchObject({ rotulo: "Parada", ncs: [4], texto: "Em plano de ação há 4 dias. É a NC há mais tempo na mesma etapa." });
  expect(itensDeAtencao({ ativas: [], agora })).toEqual([]);
});

const insights = {
  periodo: { inicio: "2026-09-14", fim: "2026-10-13" },
  kpis: { total_ncs: 4, backlog_ativo_atual: 3, abertas_atuais: 0, aguardando_feedback_atual: 1, aguardando_aceite_atual: 2, nao_respondidas_atual: 0, aceites_no_periodo: 1, aceites_no_prazo: 1, taxa_aceite_no_prazo: 1, concluidas_no_periodo: 1, invalidadas_no_periodo: 0 },
  tempos: {
    criacao_ate_validacao: { amostras: 4, mediana_segundos: 8, media_segundos: 9 },
    validacao_ate_feedback: { amostras: 3, mediana_segundos: 21, media_segundos: 240 },
    feedback_ate_aceite: { amostras: 1, mediana_segundos: 236, media_segundos: 236 },
    ciclo_total: { amostras: 1, mediana_segundos: 929, media_segundos: 929 },
    criacao_ate_decisao: { amostras: 4, mediana_segundos: 8, media_segundos: 9 },
  },
  aged_backlog: { faixas: [{ faixa: "0-1d", quantidade: 0 }, { faixa: "2-3d", quantidade: 3 }, { faixa: "4-7d", quantidade: 0 }, { faixa: "8+d", quantidade: 0 }], por_status: [], mais_antiga: { nc_id: 12, status: "aguardando_feedback", dias_na_etapa: 2, desde: "2026-10-10T14:54:34Z" } },
  ncs_por_mes: [{ mes: "2026-09", total: 0, concluidas: 0, invalidadas: 0, reincidentes: 0 }, { mes: "2026-10", total: 4, concluidas: 1, invalidadas: 0, reincidentes: 3 }],
  ncs_por_causa: [{ causa: "Apontamento de horas incoerente", total: 4, total_reincidentes: 3 }],
  ncs_por_setor: [{ setor: "Suporte", total: 4, invalidadas: 0, backlog_ativo: 3, nao_respondidas: 0 }],
  ncs_por_colaborador: [{ colaborador: "teste funcionário", setor: "Suporte", total: 4, reincidencias_12m: 3, backlog_ativo: 3 }],
  ncs_por_criticidade: [{ criticidade: "Baixa", total: 2 }, { criticidade: "Média", total: 2 }],
  medidas_por_causa: [],
  disciplina: { sugeridas: { total: 1, advertencias: 1, suspensoes: 0, avaliacoes_justa_causa: 0 }, aplicadas: { total: 0, advertencias: 0, suspensoes: 0, avaliacoes_justa_causa: 0 } },
};

test("R2: relatório gerencial gera páginas com o resumo na primeira", async () => {
  const ncs = [
    { id: 12, status: "aguardando_feedback", data: "2026-10-10", colaborador: "teste funcionário", setor: "Suporte" },
    { id: 11, status: "aguardando_aceite", data: "2026-10-10", colaborador: "teste funcionário", setor: "Suporte", prazo_aceite: "2026-10-13T21:00:00+00:00" },
    { id: 10, status: "aguardando_aceite", data: "2026-10-10", colaborador: "teste funcionário", setor: "Suporte", prazo_aceite: "2026-10-13T21:00:00+00:00" },
    { id: 5, status: "concluida", data: "2026-10-10", colaborador: "teste funcionário", setor: "Suporte", aceito_em: "2026-10-10T14:25:44Z" },
  ].sort(ordenarParaAcao);
  const causas = new Map(ncs.map((nc, index) => [nc.id, [{ descricao: "Apontamento de horas incoerente", ocorrencia_numero: 4 - index }]]));
  const bytes = await escreverResumo({
    insights, anterior: { kpis: { ...insights.kpis, total_ncs: 2, concluidas_no_periodo: 0, taxa_aceite_no_prazo: null } },
    escopo: "Toda a empresa", filtros: "nenhum", atencao: itensDeAtencao({ ativas, medidas, agora }),
    ncs, causas, medidasPendentes: medidas, geradoPor: "Lucas",
  });
  if (process.env.SGNC_PDF_RESUMO) writeFileSync(process.env.SGNC_PDF_RESUMO, bytes);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(5);
});

test("R2: o serviço usa o período anterior, o Pede atenção e a ordem para ação", () => {
  const service = readFileSync("src/lib/reports/service.ts", "utf8");
  expect(service).toContain("periodoAnterior(inicio, fim)");
  expect(service).toContain("itensDeAtencao({ ativas: recorte.ativas, medidas: pendentes })");
  expect(service).toContain("sort(ordenarParaAcao)");
});
