import { csvCell } from "./csv";
import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ApiError } from "@/lib/api/error";
import { obterEstatisticasUsuario, obterInsights } from "@/lib/analytics/service";

import { buscarNc, obterTimeline } from "@/lib/nc/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildNcReadScopeFilter, buildNcTeamScopeFilter, SUPERVISOR_VISIBLE_NC_STATUSES } from "@/lib/permissions/nc-scope";
import { listarPessoasAbaixo } from "@/lib/permissions/team-scope";
import { ehQualidade } from "@/lib/auth/papeis";
import { situacaoDoAceite } from "@/lib/nc/reincidencia";

type Row = Record<string, any>;
const A4: [number, number] = [595.28, 841.89];
const NAVY = rgb(0.09, 0.2, 0.3), GREEN = rgb(0.1, 0.66, 0.54), TEXT = rgb(0.13, 0.21, 0.29), MUTED = rgb(0.4, 0.46, 0.54);

const canonical = (status: unknown) => ["validada", "aguardando_analise"].includes(String(status)) ? "aguardando_feedback" : String(status ?? "");
const dateOnly = (value: unknown) => String(value ?? "").slice(0, 10);
const brDate = (value: unknown) => { const date = dateOnly(value); return date ? date.split("-").reverse().join("/") : "-"; };
const ROTULO_ACEITE: Record<string, string> = { aguardando: "Aguardando aceite", no_prazo: "Aceito no prazo", fora_prazo: "Aceito fora do prazo", nao_respondida: "Nao respondida", sem_feedback: "-" };
const brDateTime = (value: unknown) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(String(value))) : "-";
const hours = (start: unknown, end: unknown) => !start || !end ? "" : Math.max(0, (Date.parse(String(end)) - Date.parse(String(start))) / 3600000).toFixed(2).replace(".", ",");


function splitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of String(text || "-").split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else { if (current) lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : ["-"];
}

async function pdfWriter(title: string, subtitle: string) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage, y = 0;
  const addPage = () => { page = doc.addPage(A4); page.drawRectangle({ x: 0, y: A4[1] - 48, width: A4[0], height: 48, color: NAVY }); page.drawText("ARQUEM", { x: 42, y: A4[1] - 29, size: 12, font: bold, color: rgb(1,1,1) }); page.drawText("AUTOMACAO CORPORATIVA", { x: 42, y: A4[1] - 41, size: 6, font: regular, color: GREEN }); page.drawText(title, { x: 42, y: A4[1] - 78, size: 18, font: bold, color: NAVY }); page.drawText(subtitle, { x: 42, y: A4[1] - 94, size: 9, font: regular, color: MUTED }); y = A4[1] - 120; };
  const ensure = (height: number) => { if (y - height < 42) addPage(); };
  const heading = (text: string) => { ensure(28); y -= 8; page.drawText(text.toUpperCase(), { x: 42, y, size: 10, font: bold, color: NAVY }); y -= 18; };
  const line = (label: string, value: unknown) => { const content = `${label}: ${String(value ?? "-")}`; const lines=splitText(content,regular,9,A4[0]-84); ensure(lines.length*13+4); for(const item of lines){page.drawText(item,{x:42,y,size:9,font:regular,color:TEXT});y-=13;} y-=3; };
  addPage();
  return { doc, regular, bold, get page(){return page;}, get y(){return y;}, set y(value:number){y=value;}, addPage, ensure, heading, line };
}

export async function gerarPdfNc(id: number) {
  const nc = await buscarNc(id) as Row;
  const writer = await pdfWriter("Relatorio de Nao Conformidade", `NC #${id}`);
  writer.heading("Resumo"); writer.line("Status", canonical(nc.status)); writer.line("Criticidade", nc.criticidade); writer.line("Data", brDate(nc.data)); writer.line("Chamado", nc.chamado); writer.line("Colaborador", nc.colaborador); writer.line("Setor", nc.setor);
  writer.heading("Descricao"); writer.line("Registro", nc.descricao);
  writer.heading("Causas"); writer.line("Relacionadas", (nc.causas ?? []).join(" | ") || "Nenhuma");
  writer.heading("Feedback");
  const feedback = nc.feedback_estruturado as Row | null;
  if (feedback) {
    writer.line("Causa raiz", feedback.causa_raiz); writer.line("Acao combinada", feedback.acao_combinada);
    writer.line("Responsavel pela acao", feedback.responsavel_acao_nome ?? "Nao informado"); writer.line("Prazo da acao", feedback.prazo_acao ? brDate(feedback.prazo_acao) : "Nao informado");
    writer.line("Combinado", feedback.combinado); writer.line("Prazo do aceite", brDateTime(feedback.prazo_aceite));
    writer.line("Situacao do aceite", ROTULO_ACEITE[situacaoDoAceite(nc)]);
  } else writer.line("Registro", nc.feedback);
  const admin = createAdminClient();
  const { eventos: history } = await obterTimeline(id);
  writer.heading("Andamento"); for(const event of history ?? []) writer.line(brDate(event.criado_em), `${canonical(event.status_novo)} - ${event.observacao || "Sem observacao"}`);
  const { data: evidence } = await admin.from("evidencias").select("nome_original, caminho_storage, criado_em").eq("nc_id", id).order("criado_em");
  writer.heading("Evidencias anexadas");
  if (!evidence?.length) writer.line("Arquivos", "Nenhuma evidencia anexada");
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
      writer.page.drawImage(image, { x: 42, y: writer.y - dimensions.height, width: dimensions.width, height: dimensions.height });
      writer.y -= dimensions.height + 18;
    } catch { /* arquivo de imagem inválido: mantém o nome no relatório */ }
  }
  return { bytes: await writer.doc.save(), filename: `sgnc-nc-${id}.pdf` };
}

export async function gerarPdfDossie(userId: string) {
  const requester = await requireUser();
  const stats = await obterEstatisticasUsuario(userId) as Row;
  const writer = await pdfWriter("Dossie do Colaborador", stats.nome);
  writer.heading("Resumo"); writer.line("Nome", stats.nome); writer.line("Setor", stats.setor); writer.line("Periodo", "Ultimos 12 meses"); writer.line("Total de NCs", stats.total_nc_12m);
  writer.heading("Causas e recorrencia");
  for(const cause of stats.causas ?? []) { writer.line(String(cause.causa), `${cause.ocorrencias_12m} ocorrencia(s); ultima NC #${cause.ultima_ocorrencia_nc_id ?? "-"}; medida sugerida: ${cause.medida_sugerida ?? "nenhuma"}`); }
  const admin=createAdminClient(); let historyQuery=admin.from("nao_conformidades").select("id, data, status, criticidade, criado_em, aceito_em, aceito_fora_prazo").eq("colaborador_id",userId);
  if(!ehQualidade(requester.papel))historyQuery=historyQuery.or(`status.in.(${SUPERVISOR_VISIBLE_NC_STATUSES.join(",")}),aberto_por.eq.${requester.id}`);
  const {data:ncs}=await historyQuery.order("data",{ascending:false}).limit(12);
  const feedbacks=await ultimosFeedbacks((ncs??[]).map((nc)=>nc.id));
  writer.heading("Historico recente"); for(const nc of ncs??[]){const feedback=feedbacks.get(nc.id);const aceite=situacaoDoAceite(nc);writer.line(`NC #${nc.id}`, `${brDate(nc.data||nc.criado_em)} | ${canonical(nc.status)} | ${nc.criticidade||"-"}${aceite!=="sem_feedback"?` | ${ROTULO_ACEITE[aceite]}`:""}`);if(feedback&&!feedback.legado){writer.line("Causa raiz",feedback.causa_raiz);writer.line("Acao combinada",`${feedback.acao_combinada} (responsavel: ${feedback.responsavel_acao_nome??"-"}; prazo: ${brDate(feedback.prazo_acao)})`);}}
  writer.heading("Medidas disciplinares"); const measures=(stats.causas??[]).flatMap((cause:Row)=>cause.medidas??[]); if(!measures.length)writer.line("Registro","Nenhuma medida disciplinar registrada");for(const measure of measures)writer.line(measure.tipo,`ocorrencia ${measure.ocorrencia_gatilho}; ${brDate(measure.data_aplicacao)}`);
  return {bytes:await writer.doc.save(),filename:`sgnc-dossie-${userId}.pdf`};
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
  const headers=["NC","Data","Status","Colaborador","Setor","Criticidade","Chamado","Causas","Ocorrencias por causa","Reincidente 12m","Descricao","Criado em","Validado em","Feedback aplicado em","Aceito em","Horas ate validacao","Horas validacao-feedback","Horas feedback-aceite","Horas ciclo total","Causa raiz","Acao combinada","Responsavel pela acao","Prazo da acao","Combinado","Prazo do aceite","Situacao do aceite"];
  const lines=[headers.map(csvCell).join(";")];for(const nc of rows){const causes=byNc.get(nc.id)??[];lines.push([nc.id,dateOnly(nc.data||nc.criado_em),canonical(nc.status),nc.colaborador,nc.setor,nc.criticidade,nc.chamado,causes.map(c=>c.descricao).join(", "),causes.filter(c=>c.ocorrencia_numero!=null).map(c=>`${c.descricao} (#${c.ocorrencia_numero})`).join(", "),causes.some(c=>Number(c.ocorrencia_numero)>1)?"Sim":"Nao",nc.descricao,nc.criado_em,nc.validado_em,nc.feedback_aplicado_em,nc.aceito_em,hours(nc.criado_em,nc.validado_em),hours(nc.validado_em,nc.feedback_aplicado_em),hours(nc.feedback_aplicado_em,nc.aceito_em),hours(nc.criado_em,nc.aceito_em),...((feedback)=>feedback?[feedback.causa_raiz,feedback.acao_combinada,feedback.responsavel_acao_nome,feedback.prazo_acao,feedback.combinado,feedback.prazo_aceite,ROTULO_ACEITE[situacaoDoAceite(nc)]]:["","","","","","",ROTULO_ACEITE[situacaoDoAceite(nc)]])(feedbacks.get(nc.id))].map(csvCell).join(";"));}
  return {bytes:new TextEncoder().encode(`\uFEFF${lines.join("\r\n")}`),filename:`sgnc-ncs-${start}-${end}.csv`};
}

export async function gerarPdfResumo(params: URLSearchParams) {
  const insights=await obterInsights(params.get("inicio"),params.get("fim"),{status:params.get("status"),colaboradorId:params.get("colaborador_id"),setor:params.get("setor")}) as Row;const writer=await pdfWriter("Resumo Gerencial",`${insights.periodo.inicio} a ${insights.periodo.fim}`);const k=insights.kpis;
  writer.heading("Indicadores");writer.line("Total de NCs",k.total_ncs);writer.line("Backlog ativo",k.backlog_ativo_atual);writer.line("Aguardando avaliacao",k.abertas_atuais);writer.line("Aguardando feedback",k.aguardando_feedback_atual);writer.line("Aguardando aceite",k.aguardando_aceite_atual);writer.line("Nao respondidas",k.nao_respondidas_atual);writer.line("Taxa de aceite no prazo",k.taxa_aceite_no_prazo==null?"Sem aceites no periodo":`${Math.round(k.taxa_aceite_no_prazo*1000)/10}% (${k.aceites_no_prazo} de ${k.aceites_no_periodo})`);writer.line("Concluidas no periodo",k.concluidas_no_periodo);writer.line("Invalidadas no periodo",k.invalidadas_no_periodo);
  writer.heading("Tempos medianos");for(const [key,value] of Object.entries(insights.tempos as Row))writer.line(key.replaceAll("_"," "),value.mediana_horas==null?"Sem amostras":`${value.mediana_horas} h (${value.amostras} amostras)`);
  writer.heading("Principais causas");for(const cause of (insights.ncs_por_causa??[]).slice(0,10))writer.line(cause.causa,`${cause.total} NC(s); ${cause.total_reincidentes} reincidente(s)`);
  writer.heading("Metodologia");for(const [key,value] of Object.entries(insights.metodologia as Row))writer.line(key,value);
  return {bytes:await writer.doc.save(),filename:`sgnc-resumo-${insights.periodo.inicio}-${insights.periodo.fim}.pdf`};
}
