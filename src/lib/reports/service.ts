import { requireApiUser as requireUser } from "@/lib/auth/api";
import { ORIGENS_NC, TIPOS_NC } from "@/lib/nc/classificacao.js";
import "server-only";

import { MARGEM, pdfWriter } from "./pdf";
import { carregarHistorico, carregarRecorte, descreverRecorte, ultimosFeedbacks } from "./dados";
import { montarAbas, montarCsvSimples } from "./planilhas";
import { gerarXlsx } from "./xlsx";
import { itensDeAtencao, ordenarParaAcao, periodoAnterior } from "./regras";
import { escreverResumo } from "./resumo-pdf";
import { obterEstatisticasUsuario, obterInsights } from "@/lib/analytics/service";

import { buscarNc, obterTimeline } from "@/lib/nc/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPERVISOR_VISIBLE_NC_STATUSES } from "@/lib/permissions/nc-scope";
import { ehQualidade } from "@/lib/auth/papeis";
import { situacaoDoAceite } from "@/lib/nc/reincidencia";
import { ROTULO_ACEITE, dataBr, dataHoraBr, periodoBr, plural, rotuloSituacaoMedida, rotuloStatus, rotuloTipoMedida } from "./formato";

type Row = Record<string, any>;

const canonical = (status: unknown) => ["validada", "aguardando_analise"].includes(String(status)) ? "aguardando_feedback" : String(status ?? "");

export async function gerarPdfNc(id: number) {
  const requester = await requireUser();
  const nc = await buscarNc(id) as Row;
  const writer = await pdfWriter("Relatório de Não Conformidade", `NC #${id}`);
  writer.heading("Resumo"); writer.line("Status", rotuloStatus(nc.status)); writer.line("Criticidade", nc.criticidade); writer.line("Data", dataBr(nc.data)); writer.line("Chamado", nc.chamado); writer.line("Colaborador", nc.colaborador); writer.line("Setor", nc.setor);
  writer.heading("Descrição"); writer.line("Registro", nc.descricao);
  writer.heading("Causas"); writer.line("Relacionadas", (nc.causas ?? []).join(" | ") || "Nenhuma");
  if (nc.origem) {
    writer.heading("Classificação"); writer.line("Origem", ORIGENS_NC[nc.origem as keyof typeof ORIGENS_NC] ?? nc.origem); writer.line("Tipo", TIPOS_NC[nc.tipo_nc as keyof typeof TIPOS_NC] ?? nc.tipo_nc);
    writer.line("Procedimento", nc.procedimento || "Não informado"); if (nc.procedimento_url) writer.line("Link do procedimento", nc.procedimento_url);
  }
  writer.heading("Feedback");
  const feedback = nc.feedback_estruturado as Row | null;
  if (feedback) {
    writer.line("Causa raiz", feedback.causa_raiz); writer.line("Ação combinada", feedback.acao_combinada);
    writer.line("Responsável pela ação", feedback.responsavel_acao_nome ?? "Não informado"); writer.line("Prazo da ação", dataBr(feedback.prazo_acao, "Não informado"));
    writer.line("Combinado", feedback.combinado);
    if (feedback.resumo_conversa) writer.line("Resumo da conversa", feedback.resumo_conversa);
    const participantes = (feedback.participantes ?? []) as Array<{ nome: string }>;
    if (participantes.length) writer.line("Participantes", participantes.map((pessoa) => pessoa.nome).join(", "));
    if (feedback.posicionamento_colaborador) writer.line("Posicionamento do colaborador", feedback.posicionamento_colaborador);
    writer.line("Prazo do aceite", dataHoraBr(feedback.prazo_aceite));
    writer.line("Situação do aceite", ROTULO_ACEITE[situacaoDoAceite(nc)] || "-");
  } else writer.line("Registro", nc.feedback);
  const admin = createAdminClient();
  const { eventos: history } = await obterTimeline(id);
  writer.heading("Andamento");
  for (const event of history ?? []) writer.line(dataHoraBr(event.criado_em), `${rotuloStatus(canonical(event.status_novo))} · ${event.autor_nome ?? "Sistema"}${event.observacao ? ` · ${event.observacao}` : ""}`);
  const { data: evidence } = await admin.from("evidencias").select("nome_original, caminho_storage, criado_em").eq("nc_id", id).order("criado_em");
  writer.heading("Evidências anexadas");
  if (!evidence?.length) writer.line("Arquivos", "Nenhuma evidência anexada");
  for (const item of evidence ?? []) {
    writer.line("Arquivo", item.nome_original);
    if (!/\.(png|jpe?g)$/i.test(item.nome_original)) continue;
    const { data: file } = await admin.storage.from("evidencias").download(item.caminho_storage);
    if (!file) continue;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const image = /\.png$/i.test(item.nome_original) ? await writer.doc.embedPng(bytes) : await writer.doc.embedJpg(bytes);
      const dimensions = image.scale(Math.min(1, 460 / image.width, 300 / image.height));
      writer.ensure(dimensions.height + 18);
      writer.page.drawImage(image, { x: MARGEM, y: writer.y - dimensions.height, width: dimensions.width, height: dimensions.height });
      writer.y -= dimensions.height + 18;
    } catch { /* arquivo de imagem inválido: mantém o nome no relatório */ }
  }
  return { bytes: await writer.finish(requester.nome), filename: `sgnc-nc-${id}.pdf` };
}

export async function gerarPdfDossie(userId: string) {
  const requester = await requireUser();
  const stats = await obterEstatisticasUsuario(userId) as Row;
  const writer = await pdfWriter("Dossiê do Colaborador", stats.nome);
  writer.heading("Resumo"); writer.line("Nome", stats.nome); writer.line("Setor", stats.setor); writer.line("Período", "Últimos 12 meses"); writer.line("Total de NCs", stats.total_nc_12m);
  writer.heading("Causas e recorrência");
  for (const cause of stats.causas ?? []) writer.line(String(cause.causa), `${plural(Number(cause.ocorrencias_12m ?? 0), "ocorrência")}; última NC #${cause.ultima_ocorrencia_nc_id ?? "-"}; medida sugerida: ${cause.medida_sugerida ? rotuloTipoMedida(cause.medida_sugerida) : "nenhuma"}`);
  const admin = createAdminClient(); let historyQuery = admin.from("nao_conformidades").select("id, data, status, criticidade, criado_em, aceito_em, aceito_fora_prazo").eq("colaborador_id", userId);
  if (!ehQualidade(requester.papel)) historyQuery = historyQuery.or(`status.in.(${SUPERVISOR_VISIBLE_NC_STATUSES.join(",")}),aberto_por.eq.${requester.id}`);
  const { data: ncs } = await historyQuery.order("data", { ascending: false }).limit(12);
  const feedbacks = await ultimosFeedbacks((ncs ?? []).map((nc) => nc.id));
  writer.heading("Histórico recente");
  for (const nc of ncs ?? []) {
    const feedback = feedbacks.get(nc.id); const aceite = ROTULO_ACEITE[situacaoDoAceite(nc)];
    writer.line(`NC #${nc.id}`, `${dataBr(nc.data || nc.criado_em)} · ${rotuloStatus(nc.status)} · ${nc.criticidade || "-"}${aceite ? ` · ${aceite}` : ""}`);
    if (feedback && !feedback.legado) { writer.line("Causa raiz", feedback.causa_raiz); writer.line("Ação combinada", `${feedback.acao_combinada} (responsável: ${feedback.responsavel_acao_nome ?? "-"}; prazo: ${dataBr(feedback.prazo_acao)})`); }
  }
  writer.heading("Medidas disciplinares"); const measures = (stats.causas ?? []).flatMap((cause: Row) => cause.medidas ?? []);
  if (!measures.length) writer.line("Registro", "Nenhuma medida disciplinar registrada");
  for (const measure of measures) writer.line(rotuloTipoMedida(measure.tipo), `${rotuloSituacaoMedida(measure.status)}; ${measure.ocorrencia_gatilho}ª ocorrência; ${measure.data_aplicacao ? `aplicada em ${dataBr(measure.data_aplicacao)}` : "sem aplicação"}`);
  return { bytes: await writer.finish(requester.nome), filename: `sgnc-dossie-${userId}.pdf` };
}

/** CSV simples (proposta C), na ordem de ação. */
export async function gerarCsvNcs(params: URLSearchParams, origem: string) {
  const recorte = await carregarRecorte(params, { lideres: true });
  const texto = montarCsvSimples({ ncs: recorte.doPeriodo, causas: recorte.causas, feedbacks: recorte.feedbacks, medidas: recorte.medidas, lideres: recorte.lideres, origem });
  return { bytes: new TextEncoder().encode(texto), filename: `sgnc-ncs-${recorte.inicio}-${recorte.fim}.csv` };
}

/** Excel com abas (proposta D): NCs, Causas, Feedback, Linha do tempo, Indicadores e Leia-me. */
export async function gerarXlsxNcs(params: URLSearchParams, origem: string) {
  const recorte = await carregarRecorte(params, { lideres: true });
  const filtros = { status: params.get("status"), colaboradorId: params.get("colaborador_id"), setor: params.get("setor") };
  const [insights, historico, texto] = await Promise.all([
    obterInsights(recorte.inicio, recorte.fim, filtros) as Promise<Row>,
    carregarHistorico(recorte.doPeriodo.map((nc) => nc.id)),
    descreverRecorte(params, recorte.teamIds),
  ]);
  const abas = montarAbas({
    ncs: recorte.doPeriodo, causas: recorte.causas, feedbacks: recorte.feedbacks, medidas: recorte.medidas, lideres: recorte.lideres,
    historico, insights, origem,
    leiaMe: { geradoPor: recorte.requester.nome, geradoEm: dataHoraBr(new Date().toISOString()), periodo: periodoBr(recorte.inicio, recorte.fim), escopo: texto.escopo, filtros: texto.filtros },
  });
  return { bytes: gerarXlsx(abas), filename: `sgnc-ncs-${recorte.inicio}-${recorte.fim}.xlsx` };
}

/** Relatório gerencial (R-D1): resumo executivo na página 1 e o detalhe do período nas seguintes. */
export async function gerarPdfResumo(params: URLSearchParams) {
  const requester = await requireUser();
  const filtros = { status: params.get("status"), colaboradorId: params.get("colaborador_id"), setor: params.get("setor") };
  const insights = await obterInsights(params.get("inicio"), params.get("fim"), filtros) as Row;
  const { inicio, fim } = insights.periodo;
  const anteriorPeriodo = periodoAnterior(inicio, fim);
  const doRecorte = new URLSearchParams(params); doRecorte.set("inicio", inicio); doRecorte.set("fim", fim);
  const [anterior, recorte] = await Promise.all([
    obterInsights(anteriorPeriodo.inicio, anteriorPeriodo.fim, filtros) as Promise<Row>,
    carregarRecorte(doRecorte),
  ]);
  const texto = await descreverRecorte(params, recorte.teamIds);
  const pendentes = recorte.medidas.filter((medida) => medida.status === "sugerida" || medida.status === "aprovada");
  const bytes = await escreverResumo({
    insights, anterior, escopo: texto.escopo, filtros: texto.filtros,
    atencao: itensDeAtencao({ ativas: recorte.ativas, medidas: pendentes }),
    ncs: [...recorte.doPeriodo].sort(ordenarParaAcao), causas: recorte.causas, medidasPendentes: pendentes,
    geradoPor: requester.nome,
  });
  return { bytes, filename: `sgnc-resumo-${inicio}-${fim}.pdf` };
}
