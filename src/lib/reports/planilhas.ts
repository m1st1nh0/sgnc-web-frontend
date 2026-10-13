/** Conteúdo das planilhas (propostas C e D): Excel com abas e CSV simples, a partir do recorte já carregado. */
import { csvCell } from "./csv";
import { ROTULO_ACEITE, dataBr, dataHoraBr, rotuloSituacaoMedida, rotuloStatus, rotuloTipoMedida } from "./formato";
import { diasNaEtapa, ordenarParaAcao } from "./regras";
import type { Aba } from "./xlsx";
import { situacaoDoAceite } from "@/lib/nc/reincidencia";

type Row = Record<string, any>;

export type DadosPlanilha = {
  ncs: Row[];
  causas: Map<number, Row[]>;
  feedbacks: Map<number, Row>;
  medidas: Row[];
  lideres: Map<string, string>;
  historico?: Row[];
  insights?: Row | null;
  leiaMe?: { geradoPor: string; geradoEm: string; periodo: string; escopo: string; filtros: string };
  origem: string;
  agora?: Date;
};

const segundos = (inicio: unknown, fim: unknown) => !inicio || !fim ? null : Math.max(0, Math.round((Date.parse(String(fim)) - Date.parse(String(inicio))) / 1000));
const simNao = (valor: boolean) => valor ? "Sim" : "Não";
const ordinal = (numero: unknown) => numero == null ? "" : `${numero}ª`;
const link = (origem: string, id: number) => `${origem.replace(/\/$/, "")}/nc/${id}`;

function medidasDaNc(dados: DadosPlanilha, ncId: number, causaId?: number) {
  return dados.medidas.filter((medida) => Number(medida.nc_id) === ncId && (causaId == null || medida.causa_id === causaId));
}
const descreverMedidas = (medidas: Row[]) => medidas.map((medida) => `${rotuloTipoMedida(medida.tipo)} (${rotuloSituacaoMedida(medida.status).toLocaleLowerCase("pt-BR")})`).join("; ");

/** CSV simples (proposta C): 15 colunas para o dia a dia, na ordem de ação. */
export const CABECALHO_CSV_SIMPLES = ["NC", "Aberta em", "Etapa atual", "Dias na etapa", "Colaborador", "Setor", "Líder direto", "Criticidade", "Chamado", "Causa", "Ocorrência em 12 meses", "Prazo do aceite", "Situação do aceite", "Medida sugerida", "Link"];

export function montarCsvSimples(dados: DadosPlanilha) {
  const agora = dados.agora ?? new Date();
  const linhas = [CABECALHO_CSV_SIMPLES.map(csvCell).join(";")];
  for (const nc of [...dados.ncs].sort(ordenarParaAcao)) {
    const causas = dados.causas.get(nc.id) ?? [];
    const feedback = dados.feedbacks.get(nc.id);
    linhas.push([
      nc.id, dataBr(nc.data || nc.criado_em, ""), rotuloStatus(nc.status), diasNaEtapa(nc, agora) ?? "",
      nc.colaborador, nc.setor, dados.lideres.get(nc.colaborador_id) ?? "", nc.criticidade, nc.chamado,
      causas.map((causa) => causa.descricao).join("; "), causas.map((causa) => ordinal(causa.ocorrencia_numero)).filter(Boolean).join("; "),
      feedback ? dataHoraBr(feedback.prazo_aceite, "") : "", ROTULO_ACEITE[situacaoDoAceite(nc)],
      descreverMedidas(medidasDaNc(dados, nc.id)), link(dados.origem, nc.id),
    ].map(csvCell).join(";"));
  }
  return `﻿${linhas.join("\r\n")}`;
}

/** Excel com abas (proposta D): cada assunto numa aba, ligadas pelo número da NC. */
export function montarAbas(dados: DadosPlanilha): Aba[] {
  const agora = dados.agora ?? new Date();
  const ncs = [...dados.ncs].sort(ordenarParaAcao);

  const abaNcs: Aba = {
    nome: "NCs",
    colunas: [
      { titulo: "NC", largura: 7, tipo: "numero" }, { titulo: "Aberta em", largura: 11, tipo: "data" }, { titulo: "Etapa atual", largura: 21 },
      { titulo: "Dias na etapa", largura: 9, tipo: "numero" }, { titulo: "Criticidade", largura: 11 }, { titulo: "Crítica", largura: 8 },
      { titulo: "Colaborador", largura: 24 }, { titulo: "Setor", largura: 16 }, { titulo: "Líder direto", largura: 22 }, { titulo: "Chamado", largura: 11 },
      { titulo: "Causas", largura: 34 }, { titulo: "Reincidente", largura: 11 }, { titulo: "Descrição", largura: 50, tipo: "textoLongo" },
      { titulo: "Criada em", largura: 16, tipo: "dataHora" }, { titulo: "Validada em", largura: 16, tipo: "dataHora" }, { titulo: "Feedback enviado em", largura: 16, tipo: "dataHora" }, { titulo: "Aceita em", largura: 16, tipo: "dataHora" },
      { titulo: "Abertura até validação", largura: 12, tipo: "duracao" }, { titulo: "Validação até feedback", largura: 12, tipo: "duracao" }, { titulo: "Feedback até aceite", largura: 12, tipo: "duracao" }, { titulo: "Ciclo total", largura: 12, tipo: "duracao" },
      { titulo: "Prazo do aceite", largura: 16, tipo: "dataHora" }, { titulo: "Situação do aceite", largura: 20 }, { titulo: "Link", largura: 40 },
    ],
    linhas: ncs.map((nc) => {
      const causas = dados.causas.get(nc.id) ?? [];
      return [
        nc.id, nc.data || nc.criado_em?.slice(0, 10), rotuloStatus(nc.status), diasNaEtapa(nc, agora), nc.criticidade, simNao(nc.critica === true),
        nc.colaborador, nc.setor, dados.lideres.get(nc.colaborador_id) ?? "", nc.chamado,
        causas.map((causa) => causa.descricao).join("; "), simNao(causas.some((causa) => Number(causa.ocorrencia_numero) > 1)), nc.descricao,
        nc.criado_em, nc.validado_em, nc.feedback_aplicado_em, nc.aceito_em,
        segundos(nc.criado_em, nc.validado_em), segundos(nc.validado_em, nc.feedback_aplicado_em), segundos(nc.feedback_aplicado_em, nc.aceito_em), segundos(nc.criado_em, nc.aceito_em),
        dados.feedbacks.get(nc.id)?.prazo_aceite, ROTULO_ACEITE[situacaoDoAceite(nc)], link(dados.origem, nc.id),
      ];
    }),
  };

  const abaCausas: Aba = {
    nome: "Causas",
    colunas: [
      { titulo: "NC", largura: 7, tipo: "numero" }, { titulo: "Aberta em", largura: 11, tipo: "data" }, { titulo: "Colaborador", largura: 24 }, { titulo: "Setor", largura: 16 },
      { titulo: "Causa", largura: 36 }, { titulo: "Ocorrência em 12 meses", largura: 12, tipo: "numero" }, { titulo: "Reincidente", largura: 11 },
      { titulo: "Medida", largura: 30 }, { titulo: "Situação da medida", largura: 20 },
    ],
    linhas: ncs.flatMap((nc) => (dados.causas.get(nc.id) ?? []).map((causa) => {
      const medidas = medidasDaNc(dados, nc.id, causa.causa_id);
      return [
        nc.id, nc.data || nc.criado_em?.slice(0, 10), nc.colaborador, nc.setor, causa.descricao,
        causa.ocorrencia_numero == null ? null : Number(causa.ocorrencia_numero), simNao(Number(causa.ocorrencia_numero) > 1),
        medidas.map((medida) => rotuloTipoMedida(medida.tipo)).join("; "), medidas.map((medida) => rotuloSituacaoMedida(medida.status)).join("; "),
      ];
    })),
  };

  const abaFeedback: Aba = {
    nome: "Feedback",
    colunas: [
      { titulo: "NC", largura: 7, tipo: "numero" }, { titulo: "Colaborador", largura: 24 }, { titulo: "Causa raiz", largura: 40, tipo: "textoLongo" },
      { titulo: "Ação combinada", largura: 45, tipo: "textoLongo" }, { titulo: "Responsável pela ação", largura: 22 }, { titulo: "Prazo da ação", largura: 12, tipo: "data" },
      { titulo: "Combinado", largura: 45, tipo: "textoLongo" }, { titulo: "Enviado em", largura: 16, tipo: "dataHora" }, { titulo: "Prazo do aceite", largura: 16, tipo: "dataHora" },
      { titulo: "Situação do aceite", largura: 20 }, { titulo: "Aceita em", largura: 16, tipo: "dataHora" },
    ],
    linhas: ncs.filter((nc) => dados.feedbacks.has(nc.id)).map((nc) => {
      const feedback = dados.feedbacks.get(nc.id)!;
      return [
        nc.id, nc.colaborador, feedback.causa_raiz, feedback.acao_combinada, feedback.responsavel_acao_nome, feedback.prazo_acao, feedback.combinado,
        nc.feedback_aplicado_em || feedback.criado_em, feedback.prazo_aceite, ROTULO_ACEITE[situacaoDoAceite(nc)], nc.aceito_em,
      ];
    }),
  };

  const abaHistorico: Aba = {
    nome: "Linha do tempo",
    colunas: [
      { titulo: "NC", largura: 7, tipo: "numero" }, { titulo: "Data e hora", largura: 16, tipo: "dataHora" }, { titulo: "De", largura: 21 },
      { titulo: "Para", largura: 21 }, { titulo: "Por", largura: 24 }, { titulo: "Observação", largura: 50, tipo: "textoLongo" },
    ],
    linhas: (dados.historico ?? []).map((evento) => [
      evento.nc_id, evento.criado_em, evento.status_anterior ? rotuloStatus(evento.status_anterior) : "", rotuloStatus(evento.status_novo), evento.autor_nome, evento.observacao,
    ]),
  };

  const k = dados.insights?.kpis ?? {};
  const tempos = (dados.insights?.tempos ?? {}) as Row;
  const indicador = (nome: string, quantidade: number | null, percentual: number | null, duracao: number | null, como: string) => [nome, quantidade, percentual, duracao, como];
  const abaIndicadores: Aba = {
    nome: "Indicadores",
    colunas: [{ titulo: "Indicador", largura: 34 }, { titulo: "Quantidade", largura: 11, tipo: "numero" }, { titulo: "Percentual", largura: 11, tipo: "percentual" }, { titulo: "Duração (mediana)", largura: 12, tipo: "duracao" }, { titulo: "Como é contado", largura: 70, tipo: "textoLongo" }],
    linhas: dados.insights ? [
      indicador("NCs abertas no período", k.total_ncs, null, null, "Data de abertura dentro do período."),
      indicador("Em andamento hoje", k.backlog_ativo_atual, null, null, "Situação no momento da geração, qualquer data de abertura."),
      indicador("Aguardando avaliação hoje", k.abertas_atuais, null, null, "Situação no momento da geração."),
      indicador("Aguardando feedback hoje", k.aguardando_feedback_atual, null, null, "Situação no momento da geração."),
      indicador("Aguardando aceite hoje", k.aguardando_aceite_atual, null, null, "Situação no momento da geração."),
      indicador("Não respondidas hoje", k.nao_respondidas_atual, null, null, "Prazo do aceite (18 h de expediente) vencido sem aceite."),
      indicador("Concluídas no período", k.concluidas_no_periodo, null, null, "Aceite registrado dentro do período."),
      indicador("Invalidadas no período", k.invalidadas_no_periodo, null, null, "Decisão de invalidar registrada dentro do período."),
      indicador("Aceites no período", k.aceites_no_periodo, null, null, "Aceites registrados dentro do período."),
      indicador("Aceite no prazo", k.aceites_no_prazo, k.taxa_aceite_no_prazo ?? null, null, "Aceites do período sem a marca de fora do prazo."),
      indicador("Da abertura à validação", tempos.criacao_ate_validacao?.amostras ?? null, null, tempos.criacao_ate_validacao?.mediana_segundos ?? null, "Mediana do tempo corrido; NCs validadas no período."),
      indicador("Da validação ao feedback", tempos.validacao_ate_feedback?.amostras ?? null, null, tempos.validacao_ate_feedback?.mediana_segundos ?? null, "Mediana do tempo corrido; feedbacks enviados no período."),
      indicador("Do feedback ao aceite", tempos.feedback_ate_aceite?.amostras ?? null, null, tempos.feedback_ate_aceite?.mediana_segundos ?? null, "Mediana do tempo corrido; aceites no período."),
      indicador("Ciclo completo", tempos.ciclo_total?.amostras ?? null, null, tempos.ciclo_total?.mediana_segundos ?? null, "Mediana da abertura ao aceite; aceites no período."),
    ] : [],
  };

  const leia = dados.leiaMe;
  const abaLeiaMe: Aba = {
    nome: "Leia-me",
    colunas: [{ titulo: "Item", largura: 26 }, { titulo: "Valor", largura: 90, tipo: "textoLongo" }],
    linhas: [
      ...(leia ? [["Gerado por", leia.geradoPor], ["Gerado em", leia.geradoEm], ["Período", leia.periodo], ["Escopo", leia.escopo], ["Filtros", leia.filtros]] : []),
      ["Horários", "Todos no horário de Brasília."],
      ["Durações", "Formato [h]:mm (horas corridas). Somam e fazem média direto no Excel."],
      ["NCs", "Uma linha por NC aberta no período, na ordem de ação: Não respondida, Aguardando aceite, Aguardando avaliação, Aguardando feedback, Em plano de ação, Concluída, Invalidada."],
      ["Causas", "Uma linha por causa de cada NC. Ocorrência em 12 meses conta o mesmo colaborador com a mesma causa; a partir da 4ª o sistema sugere medida disciplinar."],
      ["Feedback", "Último feedback registrado em cada NC."],
      ["Linha do tempo", "Uma linha por mudança de etapa, com quem fez."],
      ["Indicadores", "Os mesmos números do relatório gerencial em PDF."],
    ],
  };

  return [abaNcs, abaCausas, abaFeedback, abaHistorico, abaIndicadores, abaLeiaMe];
}
