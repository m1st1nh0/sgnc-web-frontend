import { csvCell } from "./csv";
import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { MARGEM, pdfWriter } from "./pdf";
import { carregarRecorte, reportScope, ultimosFeedbacks } from "./dados";
import { itensDeAtencao, ordenarParaAcao, periodoAnterior } from "./regras";
import { escreverResumo } from "./resumo-pdf";
import { ApiError } from "@/lib/api/error";
import { obterEstatisticasUsuario, obterInsights } from "@/lib/analytics/service";

import { buscarNc, obterTimeline } from "@/lib/nc/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildNcTeamScopeFilter, SUPERVISOR_VISIBLE_NC_STATUSES } from "@/lib/permissions/nc-scope";
import { ehQualidade } from "@/lib/auth/papeis";
import { situacaoDoAceite } from "@/lib/nc/reincidencia";
import { ROTULO_ACEITE, dataBr, dataHoraBr, plural, rotuloSituacaoMedida, rotuloStatus, rotuloTipoMedida } from "./formato";

type Row = Record<string, any>;

const canonical = (status: unknown) => ["validada", "aguardando_analise"].includes(String(status)) ? "aguardando_feedback" : String(status ?? "");
const dateOnly = (value: unknown) => String(value ?? "").slice(0, 10);
const hours = (start: unknown, end: unknown) => !start || !end ? "" : Math.max(0, (Date.parse(String(end)) - Date.parse(String(start))) / 3600000).toFixed(2).replace(".", ",");

export async function gerarPdfNc(id: number) {
  const requester = await requireUser();
  const nc = await buscarNc(id) as Row;
  const writer = await pdfWriter("Relatório de Não Conformidade", `NC #${id}`);
  writer.heading("Resumo"); writer.line("Status", rotuloStatus(nc.status)); writer.line("Criticidade", nc.criticidade); writer.line("Data", dataBr(nc.data)); writer.line("Chamado", nc.chamado); writer.line("Colaborador", nc.colaborador); writer.line("Setor", nc.setor);
  writer.heading("Descrição"); writer.line("Registro", nc.descricao);
  writer.heading("Causas"); writer.line("Relacionadas", (nc.causas ?? []).join(" | ") || "Nenhuma");
  writer.heading("Feedback");
  const feedback = nc.feedback_estruturado as Row | null;
  if (feedback) {
    writer.line("Causa raiz", feedback.causa_raiz); writer.line("Ação combinada", feedback.acao_combinada);
    writer.line("Responsável pela ação", feedback.responsavel_acao_nome ?? "Não informado"); writer.line("Prazo da ação", dataBr(feedback.prazo_acao, "Não informado"));
    writer.line("Combinado", feedback.combinado); writer.line("Prazo do aceite", dataHoraBr(feedback.prazo_aceite));
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

export const CABECALHO_CSV_NCS = ["NC","Data","Status","Colaborador","Setor","Criticidade","Chamado","Causas","Ocorrências por causa","Reincidente em 12 meses","Descrição","Criada em","Validada em","Feedback enviado em","Aceita em","Horas até validação","Horas validação-feedback","Horas feedback-aceite","Horas ciclo total","Causa raiz","Ação combinada","Responsável pela ação","Prazo da ação","Combinado","Prazo do aceite","Situação do aceite"];

export async function gerarCsvNcs(params: URLSearchParams) {
  const {admin,teamIds,user:requester}=await reportScope(); const end=params.get("fim")||new Date().toISOString().slice(0,10);const endDate=new Date(`${end}T12:00:00Z`);endDate.setUTCFullYear(endDate.getUTCFullYear()-1);const start=params.get("inicio")||endDate.toISOString().slice(0,10);if(start>end)throw new ApiError("A data de início não pode ser posterior à data de fim.");
  const requestedEmployee=params.get("colaborador_id");
  if(teamIds && requestedEmployee && requestedEmployee!==requester.id && !teamIds.includes(requestedEmployee))throw new ApiError("O colaborador selecionado está fora da sua hierarquia.",403);
  let query=admin.from("nao_conformidades").select("id, data, status, colaborador_id, colaborador, setor, criticidade, chamado, descricao, criado_em, validado_em, feedback_aplicado_em, aceito_em, aceito_fora_prazo");
  if(teamIds){const scope=buildNcTeamScopeFilter(requester,teamIds);if(scope)query=query.or(scope);}
  const {data,error}=await query;if(error)throw new ApiError("Não foi possível gerar o CSV.",500);
  const status=params.get("status")?canonical(params.get("status")):null,employee=params.get("colaborador_id"),sector=params.get("setor")?.trim().toLocaleLowerCase();const rows=(data??[]).filter(nc=>{const date=dateOnly(nc.data||nc.criado_em);return date>=start&&date<=end&&(!status||canonical(nc.status)===status)&&(!employee||nc.colaborador_id===employee)&&(!sector||String(nc.setor||"").trim().toLocaleLowerCase()===sector);}).sort((a,b)=>String(b.data||b.criado_em).localeCompare(String(a.data||a.criado_em))||b.id-a.id);
  const ids=rows.map(item=>item.id);const {data:relations}=ids.length?await admin.from("nc_causas").select("nc_id, ocorrencia_numero, causas(descricao)").in("nc_id",ids):{data:[]};const byNc=new Map<number,Row[]>();for(const relation of relations??[]){const joined=relation.causas as unknown as {descricao?:string}|null;byNc.set(relation.nc_id,[...(byNc.get(relation.nc_id)??[]),{descricao:joined?.descricao,ocorrencia_numero:relation.ocorrencia_numero}]);}
  const feedbacks=await ultimosFeedbacks(ids);
  const lines=[CABECALHO_CSV_NCS.map(csvCell).join(";")];
  for(const nc of rows){
    const causes=byNc.get(nc.id)??[]; const feedback=feedbacks.get(nc.id); const aceite=ROTULO_ACEITE[situacaoDoAceite(nc)];
    lines.push([
      nc.id,dataBr(nc.data||nc.criado_em,""),rotuloStatus(nc.status),nc.colaborador,nc.setor,nc.criticidade,nc.chamado,
      causes.map(c=>c.descricao).join(", "),causes.filter(c=>c.ocorrencia_numero!=null).map(c=>`${c.descricao} (${c.ocorrencia_numero}ª)`).join(", "),causes.some(c=>Number(c.ocorrencia_numero)>1)?"Sim":"Não",
      nc.descricao,dataHoraBr(nc.criado_em,""),dataHoraBr(nc.validado_em,""),dataHoraBr(nc.feedback_aplicado_em,""),dataHoraBr(nc.aceito_em,""),
      hours(nc.criado_em,nc.validado_em),hours(nc.validado_em,nc.feedback_aplicado_em),hours(nc.feedback_aplicado_em,nc.aceito_em),hours(nc.criado_em,nc.aceito_em),
      ...(feedback?[feedback.causa_raiz,feedback.acao_combinada,feedback.responsavel_acao_nome,dataBr(feedback.prazo_acao,""),feedback.combinado,dataHoraBr(feedback.prazo_aceite,"")]:["","","","","",""]),aceite,
    ].map(csvCell).join(";"));
  }
  return {bytes:new TextEncoder().encode(`﻿${lines.join("\r\n")}`),filename:`sgnc-ncs-${start}-${end}.csv`};
}

/** Escopo e filtros do resumo em texto: quem lê o PDF sabe exatamente o recorte. */
async function recorteDoResumo(params: URLSearchParams, escopo: Row) {
  const filtros: string[] = [];
  const status = params.get("status"); if (status) filtros.push(`status ${rotuloStatus(status)}`);
  const setor = params.get("setor")?.trim(); if (setor) filtros.push(`setor ${setor}`);
  const colaboradorId = params.get("colaborador_id");
  if (colaboradorId) {
    const { data } = await createAdminClient().from("usuarios").select("nome").eq("id", colaboradorId).maybeSingle();
    filtros.push(`colaborador ${data?.nome ?? "selecionado"}`);
  }
  const escopoTexto = escopo?.tipo === "equipe_hierarquica"
    ? `Sua equipe (${plural(Number(escopo.quantidade_colaboradores ?? 0), "pessoa")})`
    : "Toda a empresa";
  return { escopo: escopoTexto, filtros: filtros.length ? filtros.join("; ") : "nenhum" };
}

/** Relatório gerencial (R-D1): resumo executivo na página 1 e o detalhe do período nas seguintes. */
export async function gerarPdfResumo(params: URLSearchParams) {
  const requester = await requireUser();
  const filtros = { status: params.get("status"), colaboradorId: params.get("colaborador_id"), setor: params.get("setor") };
  const insights = await obterInsights(params.get("inicio"), params.get("fim"), filtros) as Row;
  const { inicio, fim } = insights.periodo;
  const anteriorPeriodo = periodoAnterior(inicio, fim);
  const doRecorte = new URLSearchParams(params); doRecorte.set("inicio", inicio); doRecorte.set("fim", fim);
  const [anterior, recorte, texto] = await Promise.all([
    obterInsights(anteriorPeriodo.inicio, anteriorPeriodo.fim, filtros) as Promise<Row>,
    carregarRecorte(doRecorte),
    recorteDoResumo(params, insights.escopo),
  ]);
  const pendentes = recorte.medidas.filter((medida) => medida.status === "sugerida" || medida.status === "aprovada");
  const bytes = await escreverResumo({
    insights, anterior, escopo: texto.escopo, filtros: texto.filtros,
    atencao: itensDeAtencao({ ativas: recorte.ativas, medidas: pendentes }),
    ncs: [...recorte.doPeriodo].sort(ordenarParaAcao), causas: recorte.causas, medidasPendentes: pendentes,
    geradoPor: requester.nome,
  });
  return { bytes, filename: `sgnc-resumo-${inicio}-${fim}.pdf` };
}
