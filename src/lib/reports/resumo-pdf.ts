/** Relatório gerencial em PDF (propostas A + B): página 1 com o resumo executivo, depois o detalhe do período. */
import { COR, pdfWriter } from "./pdf";
import { ROTULO_ACEITE, dataBr, dataHoraBr, duracao, periodoBr, plural, rotuloSituacaoMedida, rotuloStatus, rotuloTipoMedida } from "./formato";
import { comparacao, type ItemAtencao } from "./regras";
import { situacaoDoAceite } from "@/lib/nc/reincidencia";

type Row = Record<string, any>;

export type DadosResumo = {
  insights: Row;
  anterior: Row | null;
  escopo: string;
  filtros: string;
  atencao: ItemAtencao[];
  ncs: Row[];
  causas: Map<number, Row[]>;
  medidasPendentes: Row[];
  geradoPor: string;
};

const LIMITE_LISTA = 300;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mes = (chave: string) => { const [ano, numero] = chave.split("-"); return `${MESES[Number(numero) - 1] ?? numero}/${ano}`; };
const pct = (taxa: number | null | undefined) => taxa == null ? "-" : `${String(Math.round(taxa * 1000) / 10).replace(".", ",")}%`;

const ROTULO_TEMPO: Record<string, string> = {
  criacao_ate_validacao: "Da abertura à validação",
  validacao_ate_feedback: "Da validação ao feedback",
  feedback_ate_aceite: "Do feedback ao aceite",
  ciclo_total: "Ciclo completo (abertura ao aceite)",
  criacao_ate_decisao: "Da abertura à decisão",
};
const FAIXAS: Record<string, string> = { "0-1d": "0 a 1 dia", "2-3d": "2 a 3 dias", "4-7d": "4 a 7 dias", "8+d": "8 dias ou mais" };

const COMO_LER: Array<[string, string]> = [
  ["NCs abertas", "NCs com data de abertura dentro do período."],
  ["Em andamento hoje", "Situação no momento da geração: todas as NCs ainda não concluídas nem invalidadas, de qualquer data de abertura. Por ser uma foto de hoje, não tem comparação com o período anterior."],
  ["Período anterior", "Mesmo número de dias, terminando na véspera do início do período."],
  ["Concluídas e aceites", "Contam pela data do aceite. Aceite no prazo é o registrado em até 2 dias úteis (18 horas de expediente, segunda a sexta, 9h às 18h) depois do envio do feedback."],
  ["Não respondida", "O prazo do aceite venceu sem aceite. O colaborador ainda pode aceitar; o aceite fica marcado como fora do prazo."],
  ["Tempos", "Tempo corrido de cada etapa, contando as NCs que terminaram a etapa dentro do período. A mediana é o valor do meio: metade das NCs levou menos que isso."],
  ["Reincidência", "Mesmo colaborador e mesma causa mais de uma vez nos últimos 12 meses. A partir da 4ª ocorrência o sistema sugere medida disciplinar, que a Qualidade aprova ou reprova."],
  ["Pessoas", "Qualidade e Adm veem a empresa toda; supervisores veem só a própria equipe."],
];

export async function escreverResumo(dados: DadosResumo) {
  const { insights, anterior } = dados;
  const k = insights.kpis, ka = anterior?.kpis;
  const periodo = periodoBr(insights.periodo.inicio, insights.periodo.fim);
  const w = await pdfWriter("Resumo Gerencial", periodo);
  const dias = Math.round((Date.parse(insights.periodo.fim) - Date.parse(insights.periodo.inicio)) / 86_400_000) + 1;
  w.paragrafo(`${plural(dias, "dia")} · ${dados.escopo} · Filtros: ${dados.filtros}`, { cor: COR.muted });

  // Página 1: resumo executivo.
  w.heading("Números do período");
  const criticidade = (insights.ncs_por_criticidade ?? []).map((item: Row) => `${item.total} ${item.criticidade}`).join(" · ");
  w.cartoes([
    { rotulo: "NCs abertas", valor: String(k.total_ncs), detalhe: criticidade || "nenhuma no período", comparacao: anterior ? comparacao(k.total_ncs, ka.total_ncs) : undefined },
    { rotulo: "Em andamento", valor: String(k.backlog_ativo_atual), detalhe: "situação de hoje", comparacao: "todas as datas de abertura" },
    { rotulo: "Concluídas", valor: String(k.concluidas_no_periodo), detalhe: `${plural(k.invalidadas_no_periodo, "invalidada")}`, comparacao: anterior ? comparacao(k.concluidas_no_periodo, ka.concluidas_no_periodo) : undefined },
    { rotulo: "Aceite no prazo", valor: k.taxa_aceite_no_prazo == null ? "-" : pct(k.taxa_aceite_no_prazo), detalhe: k.aceites_no_periodo ? `${k.aceites_no_prazo} de ${plural(k.aceites_no_periodo, "aceite")}` : "sem aceites no período", comparacao: anterior ? comparacao(k.taxa_aceite_no_prazo, ka.taxa_aceite_no_prazo, "percentual") : undefined },
  ]);

  w.heading("Pede atenção");
  if (dados.atencao.length) w.atencao(dados.atencao.slice(0, 7).map((item) => ({ ...item, referencia: item.ncs.length ? `NC ${item.ncs.slice(0, 4).map((id) => `#${id}`).join(", ")}${item.ncs.length > 4 ? "…" : ""}` : undefined })));
  else w.paragrafo("Nada fora do normal: nenhum aceite vencendo, nenhuma NC não respondida ou crítica, nenhuma medida pendente e nenhuma NC parada há 2 dias ou mais.", { cor: COR.muted });

  w.heading("Onde estão as NCs hoje");
  const emPlano = (insights.aged_backlog?.por_status ?? []).find((item: Row) => item.status === "em_plano_acao")?.quantidade ?? 0;
  w.barras([
    { rotulo: "Aguardando avaliação", valor: k.abertas_atuais },
    { rotulo: "Aguardando feedback", valor: k.aguardando_feedback_atual },
    { rotulo: "Aguardando aceite", valor: k.aguardando_aceite_atual, cor: COR.warn },
    { rotulo: "Não respondida", valor: k.nao_respondidas_atual, cor: COR.crit },
    { rotulo: "Em plano de ação", valor: emPlano },
  ]);

  w.heading("Quanto tempo leva");
  const tempos = Object.entries(insights.tempos as Row).filter(([chave]) => chave !== "criacao_ate_decisao");
  w.tabela(
    [{ titulo: "Etapa", largura: 5 }, { titulo: "NCs", largura: 1, alinhar: "direita" }, { titulo: "Mediana", largura: 2, alinhar: "direita" }, { titulo: "Média", largura: 2, alinhar: "direita" }],
    tempos.map(([chave, valor]) => [ROTULO_TEMPO[chave] ?? chave, String(valor.amostras), valor.amostras ? duracao(valor.mediana_segundos) : "-", valor.amostras ? duracao(valor.media_segundos) : "-"]),
  );

  w.heading("Principais causas");
  w.tabela(
    [{ titulo: "Causa", largura: 6 }, { titulo: "NCs", largura: 1, alinhar: "direita" }, { titulo: "Reincidentes", largura: 2, alinhar: "direita" }],
    (insights.ncs_por_causa ?? []).slice(0, 5).map((item: Row) => [item.causa, String(item.total), `${item.total_reincidentes} de ${item.total}`]),
    { vazio: "Nenhuma NC com causa no período." },
  );

  // Página 2: fluxo e prazos.
  w.secao("Fluxo e prazos", "Como as NCs do período andaram mês a mês, há quanto tempo as que estão em andamento esperam e como foram os aceites.");
  w.heading("NCs por mês");
  const meses = (insights.ncs_por_mes ?? []) as Row[];
  w.barras(meses.map((item) => ({ rotulo: mes(item.mes), valor: item.total })), { larguraRotulo: 70 });
  w.tabela(
    [{ titulo: "Mês", largura: 2 }, { titulo: "Abertas", largura: 1, alinhar: "direita" }, { titulo: "Concluídas", largura: 1, alinhar: "direita" }, { titulo: "Invalidadas", largura: 1, alinhar: "direita" }, { titulo: "Reincidentes", largura: 1, alinhar: "direita" }],
    meses.map((item) => [mes(item.mes), String(item.total), String(item.concluidas), String(item.invalidadas), String(item.reincidentes)]),
  );
  w.heading("Há quanto tempo estão na etapa atual");
  w.barras((insights.aged_backlog?.faixas ?? []).map((item: Row) => ({ rotulo: FAIXAS[item.faixa] ?? item.faixa, valor: item.quantidade, cor: item.faixa === "8+d" ? COR.crit : item.faixa === "4-7d" ? COR.warn : COR.navy })));
  const antiga = insights.aged_backlog?.mais_antiga;
  if (antiga) w.paragrafo(`Mais antiga: NC #${antiga.nc_id}, ${rotuloStatus(antiga.status)} desde ${dataHoraBr(antiga.desde)} (${plural(antiga.dias_na_etapa, "dia")}).`, { cor: COR.muted });
  w.heading("Aceites");
  w.line("Aceites registrados no período", k.aceites_no_periodo);
  w.line("No prazo", `${k.aceites_no_prazo} (${pct(k.taxa_aceite_no_prazo)})`);
  w.line("Fora do prazo", k.aceites_no_periodo - k.aceites_no_prazo);
  w.line("Não respondidas hoje", k.nao_respondidas_atual);

  // Página 3: causas, setores e pessoas.
  w.secao("Causas, setores e pessoas", dados.escopo.startsWith("Toda") ? "Toda a empresa." : `${dados.escopo}: só pessoas da sua equipe aparecem aqui.`);
  w.heading("Causas");
  w.tabela(
    [{ titulo: "Causa", largura: 6 }, { titulo: "NCs", largura: 1, alinhar: "direita" }, { titulo: "Reincidentes", largura: 2, alinhar: "direita" }],
    (insights.ncs_por_causa ?? []).map((item: Row) => [item.causa, String(item.total), String(item.total_reincidentes)]),
    { vazio: "Nenhuma NC com causa no período." },
  );
  w.heading("Setores");
  w.tabela(
    [{ titulo: "Setor", largura: 4 }, { titulo: "NCs", largura: 1, alinhar: "direita" }, { titulo: "Invalidadas", largura: 1.5, alinhar: "direita" }, { titulo: "Em andamento", largura: 1.5, alinhar: "direita" }, { titulo: "Não respondidas", largura: 1.7, alinhar: "direita" }],
    (insights.ncs_por_setor ?? []).map((item: Row) => [item.setor, String(item.total), String(item.invalidadas), String(item.backlog_ativo), String(item.nao_respondidas)]),
  );
  w.heading("Colaboradores");
  w.tabela(
    [{ titulo: "Colaborador", largura: 4 }, { titulo: "Setor", largura: 3 }, { titulo: "NCs", largura: 1, alinhar: "direita" }, { titulo: "Reincidências", largura: 1.6, alinhar: "direita" }, { titulo: "Em andamento", largura: 1.6, alinhar: "direita" }],
    (insights.ncs_por_colaborador ?? []).slice(0, 20).map((item: Row) => [item.colaborador, item.setor || "-", String(item.total), String(item.reincidencias_12m), String(item.backlog_ativo)]),
  );
  if ((insights.ncs_por_colaborador ?? []).length > 20) w.paragrafo("Mostrando as 20 pessoas com mais NCs. A lista completa está na planilha.", { cor: COR.muted });
  w.heading("Criticidade");
  w.barras((insights.ncs_por_criticidade ?? []).map((item: Row) => ({ rotulo: item.criticidade, valor: item.total })));

  // Página 4: medidas disciplinares.
  w.secao("Medidas disciplinares", "Sugeridas pela regra de reincidência e decididas pela Qualidade.");
  const disciplina = insights.disciplina ?? {};
  const porTipo = (grupo: Row | undefined) => `${grupo?.total ?? 0} (${plural(grupo?.advertencias ?? 0, "advertência")}, ${plural(grupo?.suspensoes ?? 0, "suspensão", "suspensões")}, ${plural(grupo?.avaliacoes_justa_causa ?? 0, "avaliação", "avaliações")} de justa causa)`;
  w.line("Sugeridas no período", porTipo(disciplina.sugeridas));
  w.line("Aplicadas no período", porTipo(disciplina.aplicadas));
  w.heading("Pendentes de decisão ou aplicação");
  const colaboradorDaNc = new Map(dados.ncs.map((nc) => [Number(nc.id), nc.colaborador]));
  w.tabela(
    [{ titulo: "NC", largura: 0.8 }, { titulo: "Colaborador", largura: 3 }, { titulo: "Causa", largura: 3.5 }, { titulo: "Medida", largura: 2.2 }, { titulo: "Situação", largura: 2 }],
    dados.medidasPendentes.map((medida) => [`#${medida.nc_id}`, colaboradorDaNc.get(Number(medida.nc_id)) ?? "-", `${medida.causa ?? "-"} (${medida.ocorrencia_gatilho}ª)`, rotuloTipoMedida(medida.tipo), rotuloSituacaoMedida(medida.status)]),
    { vazio: "Nenhuma medida aguardando decisão ou aplicação." },
  );
  w.heading("Aplicadas por causa");
  w.tabela(
    [{ titulo: "Causa", largura: 5 }, { titulo: "Advertências", largura: 1.4, alinhar: "direita" }, { titulo: "Suspensões", largura: 1.4, alinhar: "direita" }, { titulo: "Justa causa", largura: 1.4, alinhar: "direita" }],
    (insights.medidas_por_causa ?? []).map((item: Row) => [item.causa, String(item.advertencias), String(item.suspensoes), String(item.avaliacoes_justa_causa)]),
    { vazio: "Nenhuma medida aplicada no período." },
  );

  // Página 5+: lista das NCs.
  w.secao("NCs do período", "As que pedem ação primeiro; depois as mais recentes.");
  w.tabela(
    [{ titulo: "NC", largura: 0.7 }, { titulo: "Aberta em", largura: 1.4 }, { titulo: "Colaborador", largura: 2.4 }, { titulo: "Setor", largura: 1.6 }, { titulo: "Causa", largura: 2.8 }, { titulo: "Etapa", largura: 2 }, { titulo: "Aceite", largura: 2 }],
    dados.ncs.slice(0, LIMITE_LISTA).map((nc) => {
      const aceite = nc.status === "aguardando_aceite" && nc.prazo_aceite ? `até ${dataHoraBr(nc.prazo_aceite)}` : ROTULO_ACEITE[situacaoDoAceite(nc)] || "-";
      const causas = (dados.causas.get(nc.id) ?? []).map((causa) => `${causa.descricao}${Number(causa.ocorrencia_numero) > 1 ? ` (${causa.ocorrencia_numero}ª)` : ""}`).join("; ");
      return [`#${nc.id}`, dataBr(nc.data || nc.criado_em), nc.colaborador || "-", nc.setor || "-", causas || "-", rotuloStatus(nc.status), aceite];
    }),
    { vazio: "Nenhuma NC no período." },
  );
  if (dados.ncs.length > LIMITE_LISTA) w.paragrafo(`Mostrando ${LIMITE_LISTA} de ${dados.ncs.length} NCs. A lista completa está na planilha.`, { cor: COR.muted });

  w.secao("Como ler este relatório");
  for (const [rotulo, texto] of COMO_LER) w.line(rotulo, texto);

  return w.finish(dados.geradoPor);
}
