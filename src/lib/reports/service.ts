import { csvCell } from "./csv";
import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { MARGEM, pdfWriter } from "./pdf";
import { ApiError } from "@/lib/api/error";
import { obterEstatisticasUsuario, obterInsights } from "@/lib/analytics/service";

import { buscarNc, obterTimeline } from "@/lib/nc/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildNcReadScopeFilter, buildNcTeamScopeFilter, SUPERVISOR_VISIBLE_NC_STATUSES } from "@/lib/permissions/nc-scope";
import { listarPessoasAbaixo } from "@/lib/permissions/team-scope";
import { ehQualidade } from "@/lib/auth/papeis";
import { situacaoDoAceite } from "@/lib/nc/reincidencia";
import { ROTULO_ACEITE, dataBr, dataHoraBr, duracao, periodoBr, plural, rotuloSituacaoMedida, rotuloStatus, rotuloTipoMedida } from "./formato";

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

/** Último feedback estruturado de cada NC, com o nome do responsável pela ação. */
async function ultimosFeedbacks(ncIds: number[]) {
  const result = new Map<number, Row>();
  if (!ncIds.length) return result;
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from("nc_feedbacks")
    .select("nc_id, versao, causa_raiz, acao_combinada, responsavel_acao_id, prazo_acao, combinado, prazo_aceite, legado").in("nc_id", ncIds);
  if (error) throw new ApiError("Não foi possível carregar os feedbacks.", 500);
  for (const row of data ?? []) { const atual = result.get(row.nc_id); if (!atual || row.versao > atual.versao) result.set(row.nc_id, row); }
  const ids = [...new Set([...result.values()].map((row) => row.responsavel_acao_id).filter(Boolean))];
  if (ids.length) {
    const { data: pessoas, error: pessoasError } = await admin.from("usuarios").select("id, nome").in("id", ids);
    if (pessoasError) throw new ApiError("Não foi possível carregar os feedbacks.", 500);
    const nomes = new Map((pessoas ?? []).map((pessoa: Row) => [pessoa.id, pessoa.nome]));
    for (const row of result.values()) row.responsavel_acao_nome = nomes.get(row.responsavel_acao_id) ?? null;
  }
  return result;
}

async function reportScope() {
  const user=await requireUser(); if(!ehQualidade(user.papel)&&user.papel!=="supervisor")throw new ApiError("Acesso restrito à Qualidade e às lideranças.",403);
  const admin=createAdminClient(); let teamIds:string[]|null=null;
  if(user.papel==="supervisor"){teamIds=(await listarPessoasAbaixo(user.id)).map((person)=>person.id);}
  return {admin,teamIds,user};
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

const ROTULO_TEMPO: Record<string, string> = {
  criacao_ate_validacao: "Da abertura à validação",
  validacao_ate_feedback: "Da validação ao feedback",
  feedback_ate_aceite: "Do feedback ao aceite",
  ciclo_total: "Ciclo completo (abertura ao aceite)",
  criacao_ate_decisao: "Da abertura à decisão",
};

const METODOLOGIA_RESUMO: Array<[string, string]> = [
  ["Volume", "Conta as NCs abertas dentro do período."],
  ["Em andamento", "Situação de hoje: todas as NCs ainda não concluídas nem invalidadas, de qualquer data de abertura."],
  ["Tempos", "Mediana do tempo corrido de cada etapa, contando as NCs que concluíram a etapa dentro do período."],
  ["Reincidência", "Mesmo colaborador e mesma causa mais de uma vez nos últimos 12 meses."],
];

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
  return { escopo: escopoTexto, filtros: filtros.length ? filtros.join("; ") : "Nenhum" };
}

export async function gerarPdfResumo(params: URLSearchParams) {
  const requester = await requireUser();
  const insights = await obterInsights(params.get("inicio"), params.get("fim"), { status: params.get("status"), colaboradorId: params.get("colaborador_id"), setor: params.get("setor") }) as Row;
  const writer = await pdfWriter("Resumo Gerencial", periodoBr(insights.periodo.inicio, insights.periodo.fim));
  const k = insights.kpis;
  const recorte = await recorteDoResumo(params, insights.escopo);
  writer.heading("Recorte"); writer.line("Período", periodoBr(insights.periodo.inicio, insights.periodo.fim)); writer.line("Escopo", recorte.escopo); writer.line("Filtros", recorte.filtros);
  writer.heading("Indicadores");
  writer.line("NCs abertas no período", k.total_ncs);
  writer.line("Em andamento hoje", k.backlog_ativo_atual);
  writer.line("Aguardando avaliação", k.abertas_atuais); writer.line("Aguardando feedback", k.aguardando_feedback_atual); writer.line("Aguardando aceite", k.aguardando_aceite_atual); writer.line("Não respondidas", k.nao_respondidas_atual);
  writer.line("Taxa de aceite no prazo", k.taxa_aceite_no_prazo == null ? "Sem aceites no período" : `${String(Math.round(k.taxa_aceite_no_prazo * 1000) / 10).replace(".", ",")}% (${k.aceites_no_prazo} de ${plural(k.aceites_no_periodo, "aceite")})`);
  writer.line("Concluídas no período", k.concluidas_no_periodo); writer.line("Invalidadas no período", k.invalidadas_no_periodo);
  writer.heading("Tempos medianos");
  for (const [key, value] of Object.entries(insights.tempos as Row)) writer.line(ROTULO_TEMPO[key] ?? key, value.amostras ? `${duracao(value.mediana_segundos)} (mediana de ${plural(value.amostras, "NC", "NCs")})` : "Sem NCs nesta etapa no período");
  writer.heading("Principais causas");
  const causas = (insights.ncs_por_causa ?? []).slice(0, 10);
  if (!causas.length) writer.line("Causas", "Nenhuma NC com causa no período");
  for (const cause of causas) writer.line(cause.causa, `${plural(cause.total, "NC", "NCs")}; ${plural(cause.total_reincidentes, "reincidente")}`);
  writer.heading("Como ler este resumo"); for (const [rotulo, texto] of METODOLOGIA_RESUMO) writer.line(rotulo, texto);
  return { bytes: await writer.finish(requester.nome), filename: `sgnc-resumo-${insights.periodo.inicio}-${insights.periodo.fim}.pdf` };
}
