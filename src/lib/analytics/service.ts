import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildNcReadScopeFilter, buildNcTeamScopeFilter } from "@/lib/permissions/nc-scope";
import { listarPessoasAbaixo, validarAcessoPessoa } from "@/lib/permissions/team-scope";
import { ehQualidade } from "@/lib/auth/papeis";

const ACTIVE = new Set(["aberta", "aguardando_feedback", "aguardando_aceite", "nao_respondida", "em_plano_acao", "validada", "aguardando_analise"]);
const COUNTABLE = new Set(["validada", "aguardando_analise", "aguardando_feedback", "aguardando_aceite", "nao_respondida", "em_plano_acao", "concluida"]);
const STATUS_ORDER = ["aberta", "aguardando_feedback", "aguardando_aceite", "nao_respondida", "em_plano_acao", "concluida", "invalidada"];
const FILTER_STATUS_ALIASES: Record<string, string[]> = {
  aberta: ["aberta"],
  aguardando_feedback: ["aguardando_feedback", "aguardando_analise", "validada"],
  aguardando_aceite: ["aguardando_aceite"],
  nao_respondida: ["nao_respondida"],
  em_plano_acao: ["em_plano_acao"],
  concluida: ["concluida"],
  invalidada: ["invalidada"],
};
type Row = Record<string, any>;

const isoDate = (value: unknown) => String(value ?? "").slice(0, 10) || null;
const canonicalStatus = (value: unknown) => ["validada", "aguardando_analise"].includes(String(value)) ? "aguardando_feedback" : String(value ?? "");
const seconds = (start: unknown, end: unknown) => {
  if (!start || !end) return null;
  const result = Math.floor((Date.parse(String(end)) - Date.parse(String(start))) / 1000);
  return Number.isFinite(result) && result >= 0 ? result : null;
};
const suggestedMeasure = (occurrence: number) => {
  if (occurrence <= 3 || (occurrence - 4) % 3 !== 0) return null;
  const measure = Math.floor((occurrence - 4) / 3) + 1;
  return measure <= 3 ? "advertencia" : measure <= 6 ? "suspensao" : "avaliar_justa_causa";
};
const inc = (map: Map<string, number>, key: unknown) => map.set(String(key), (map.get(String(key)) ?? 0) + 1);
const count = (map: Map<string, number>, key: unknown) => map.get(String(key)) ?? 0;

function startTwelveMonths(end: Date) {
  const value = new Date(end);
  value.setUTCFullYear(value.getUTCFullYear() - 1);
  return value.toISOString().slice(0, 10);
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function causeMap(ncIds: number[]) {
  if (!ncIds.length) return new Map<number, Row[]>();
  const { data, error } = await createAdminClient().from("nc_causas")
    .select("nc_id, causa_id, ocorrencia_numero, causas(descricao)").in("nc_id", ncIds);
  if (error) throw new ApiError("Não foi possível carregar as causas das NCs.", 500);
  const map = new Map<number, Row[]>();
  for (const row of data ?? []) {
    const joined = row.causas as unknown as { descricao?: string } | null;
    map.set(row.nc_id, [...(map.get(row.nc_id) ?? []), { causa_id: row.causa_id, descricao: joined?.descricao, ocorrencia_numero: row.ocorrencia_numero }]);
  }
  return map;
}

export async function obterEstatisticasUsuario(userId: string) {
  const requester = await requireUser();
  await validarAcessoPessoa(requester, userId);
  const admin = createAdminClient();
  const { data: employee, error } = await admin.from("usuarios").select("id, nome, setor, papel, supervisor_id").eq("id", userId).maybeSingle();
  if (error || !employee) throw new ApiError("Usuário não encontrado.", 404);
  const end = new Date();
  const endDate = end.toISOString().slice(0, 10);
  const startDate = startTwelveMonths(end);
  let ncQuery = admin.from("nao_conformidades").select("id, data")
    .eq("colaborador_id", userId).in("status", [...COUNTABLE]).gte("data", startDate).lte("data", endDate);
  if (!ehQualidade(requester.papel)) {
    const teamIds = requester.papel === "supervisor" ? (await listarPessoasAbaixo(requester.id)).map((person) => person.id) : [];
    const scope = buildNcReadScopeFilter(requester, teamIds);
    if (scope) ncQuery = ncQuery.or(scope);
  }
  const { data: ncs, error: ncsError } = await ncQuery;
  if (ncsError) throw new ApiError("Não foi possível carregar as estatísticas.", 500);
  const ids = (ncs ?? []).map((item) => item.id);
  const causes = await causeMap(ids);
  const dates = new Map((ncs ?? []).map((item) => [item.id, isoDate(item.data) ?? ""]));
  const grouped = new Map<number, Row>();
  for (const [ncId, rows] of causes) for (const cause of rows) {
    const item = grouped.get(cause.causa_id) ?? { causa_id: cause.causa_id, causa: cause.descricao, ocorrencias_12m: 0, ultima_ocorrencia_numero: null, ultima_ocorrencia_nc_id: null, medida_sugerida: null, _last: "" };
    item.ocorrencias_12m++;
    const key = `${dates.get(ncId)}:${String(ncId).padStart(12, "0")}`;
    if (key > item._last) { item._last = key; item.ultima_ocorrencia_numero = cause.ocorrencia_numero; item.ultima_ocorrencia_nc_id = ncId; }
    grouped.set(cause.causa_id, item);
  }
  let measures: Row[] = [];
  if (ids.length) {
    const { data, error: measuresError } = await admin.from("medidas_disciplinares")
      .select("id, causa_id, nc_id, ocorrencia_gatilho, tipo, status, dias_suspensao, data_aplicacao, observacao")
      .in("nc_id", ids).order("data_aplicacao", { ascending: false });
    if (measuresError) throw new ApiError("Não foi possível carregar as medidas disciplinares.", 500);
    measures = data ?? [];
  }
  const result = [...grouped.values()].map((item) => {
    delete item._last;
    if (ehQualidade(requester.papel) && item.ultima_ocorrencia_numero != null) item.medida_sugerida = suggestedMeasure(Number(item.ultima_ocorrencia_numero));
    item.medidas = (measures ?? []).filter((measure) => measure.causa_id === item.causa_id);
    return item;
  }).sort((a, b) => b.ocorrencias_12m - a.ocorrencias_12m);
  return { usuario_id: employee.id, nome: employee.nome, setor: employee.setor, total_nc_12m: ids.length, causas: result };
}

function timeSummary(values: Array<number | null>) {
  const clean = values.filter((value): value is number => value != null && value >= 0).sort((a, b) => a - b);
  if (!clean.length) return { amostras: 0, media_segundos: null, mediana_segundos: null, media_horas: null, mediana_horas: null };
  const average = Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
  const middle = Math.floor(clean.length / 2);
  const median = Math.round(clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2);
  return { amostras: clean.length, media_segundos: average, mediana_segundos: median, media_horas: Math.round(average / 36) / 100, mediana_horas: Math.round(median / 36) / 100 };
}

function monthKeys(start: string, end: string) {
  const keys: string[] = [];
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const limit = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  while (cursor <= limit) { keys.push(cursor.toISOString().slice(0, 7)); cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
  return keys;
}

export async function obterInsights(
  startInput?: string | null,
  endInput?: string | null,
  filters: { status?: string | null; colaboradorId?: string | null; setor?: string | null } = {},
) {
  const user = await requireUser();
  if (!ehQualidade(user.papel) && user.papel !== "supervisor") throw new ApiError("Acesso restrito à Qualidade e às lideranças.", 403);
  const end = endInput || new Date().toISOString().slice(0, 10);
  const start = startInput || startTwelveMonths(new Date(`${end}T12:00:00Z`));
  if (!isIsoDate(start) || !isIsoDate(end)) throw new ApiError("O período informado é inválido.");
  if (start > end) throw new ApiError("A data de início não pode ser posterior à data de fim.");
  const selectedStatuses = filters.status ? FILTER_STATUS_ALIASES[filters.status] : null;
  if (filters.status && !selectedStatuses) throw new ApiError("O status selecionado é inválido.", 422);
  const collaboratorId = filters.colaboradorId?.trim() || null;
  if (collaboratorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(collaboratorId)) {
    throw new ApiError("O colaborador selecionado é inválido.", 422);
  }
  const sector = filters.setor?.trim() || null;
  if (sector && sector.length > 120) throw new ApiError("O setor selecionado é inválido.", 422);
  const admin = createAdminClient();
  let teamIds: string[] | null = null;
  if (user.papel === "supervisor") {
    teamIds = (await listarPessoasAbaixo(user.id)).map((person) => person.id);
  }
  if (teamIds && collaboratorId && collaboratorId !== user.id && !teamIds.includes(collaboratorId)) {
    throw new ApiError("O colaborador selecionado está fora da sua hierarquia.", 403);
  }
  let query = admin.from("nao_conformidades").select("id, data, status, colaborador_id, colaborador, setor, criticidade, chamado, criado_em, atualizado_em, validado_em, feedback_aplicado_em, aceito_em, aceito_fora_prazo, decidido_em, enviado_em");
  if (teamIds) {
    const scope = buildNcTeamScopeFilter(user, teamIds);
    if (scope) query = query.or(scope);
  }
  if (selectedStatuses) query = query.in("status", selectedStatuses);
  if (collaboratorId) query = query.eq("colaborador_id", collaboratorId);
  if (sector) query = query.eq("setor", sector);
  const { data, error } = await query;
  if (error) throw new ApiError("Não foi possível carregar os insights.", 500);
  const all = (data ?? []) as Row[];
  const period = all.filter((nc) => { const date = isoDate(nc.data) || isoDate(nc.criado_em); return date && date >= start && date <= end; });
  const active = all.filter((nc) => ACTIVE.has(nc.status));
  // Cause details are only used in period-based charts and suggestions. Avoid
  // fetching cause rows for every historical NC just to discard them in JS.
  const periodIds = period.map((nc) => nc.id);
  const causes = await causeMap(periodIds);
  let measures: Row[] = [];
  if (teamIds === null || all.length) {
    let measuresQuery = admin.from("medidas_disciplinares").select("causa_id, colaborador_id, nc_id, ocorrencia_gatilho, tipo, status, data_aplicacao, criado_em");
    if (teamIds || selectedStatuses || collaboratorId || sector) {
      measuresQuery = measuresQuery.in("nc_id", all.map((nc) => nc.id));
    }
    // The calculations below discard measures outside the selected window.
    // Push that window into Postgres, including the same created_at fallback
    // used when data_aplicacao is null.
    const next = nextDate(end);
    measuresQuery = measuresQuery.or(
      `and(data_aplicacao.gte.${start},data_aplicacao.lt.${next}),and(data_aplicacao.is.null,criado_em.gte.${start}T00:00:00Z,criado_em.lt.${next}T00:00:00Z)`,
    );
    const { data, error: measureError } = await measuresQuery;
    if (measureError) throw new ApiError("Não foi possível carregar os indicadores disciplinares.", 500);
    measures = data ?? [];
  }
  const periodStatus = new Map<string, number>(), backlogStatus = new Map<string, number>();
  period.forEach((nc) => inc(periodStatus, canonicalStatus(nc.status))); active.forEach((nc) => inc(backlogStatus, canonicalStatus(nc.status)));
  const inPeriod = (value: unknown) => { const date = isoDate(value); return !!date && date >= start && date <= end; };
  // Aceites registrados no período; os marcados fora do prazo (D11) baixam a taxa de aceite no prazo.
  const aceitesNoPeriodo = all.filter((nc) => inPeriod(nc.aceito_em));
  const kpis = { total_ncs: period.length, ncs_abertas: count(periodStatus, "aberta"), ncs_pendentes: count(periodStatus, "aguardando_feedback") + count(periodStatus, "aguardando_aceite") + count(periodStatus, "nao_respondida"), ncs_concluidas: count(periodStatus, "concluida"), ncs_invalidadas: count(periodStatus, "invalidada"), taxa_invalidacao: period.length ? Math.round(count(periodStatus, "invalidada") / period.length * 10000) / 10000 : null, ncs_sem_chamado: period.filter((nc) => !String(nc.chamado ?? "").trim()).length, backlog_ativo_atual: active.length, abertas_atuais: count(backlogStatus, "aberta"), aguardando_feedback_atual: count(backlogStatus, "aguardando_feedback"), aguardando_aceite_atual: count(backlogStatus, "aguardando_aceite"), nao_respondidas_atual: count(backlogStatus, "nao_respondida"), aceites_no_periodo: aceitesNoPeriodo.length, aceites_no_prazo: aceitesNoPeriodo.filter((nc) => nc.aceito_fora_prazo !== true).length, taxa_aceite_no_prazo: aceitesNoPeriodo.length ? Math.round(aceitesNoPeriodo.filter((nc) => nc.aceito_fora_prazo !== true).length / aceitesNoPeriodo.length * 10000) / 10000 : null, concluidas_no_periodo: all.filter((nc) => nc.status === "concluida" && inPeriod(nc.aceito_em)).length, invalidadas_no_periodo: all.filter((nc) => nc.status === "invalidada" && inPeriod(nc.decidido_em)).length };
  const durations = { criacao_ate_validacao: timeSummary(all.filter((nc) => inPeriod(nc.validado_em)).map((nc) => seconds(nc.criado_em, nc.validado_em))), validacao_ate_feedback: timeSummary(all.filter((nc) => inPeriod(nc.feedback_aplicado_em)).map((nc) => seconds(nc.validado_em, nc.feedback_aplicado_em))), feedback_ate_aceite: timeSummary(all.filter((nc) => inPeriod(nc.aceito_em)).map((nc) => seconds(nc.feedback_aplicado_em, nc.aceito_em))), ciclo_total: timeSummary(all.filter((nc) => inPeriod(nc.aceito_em)).map((nc) => seconds(nc.criado_em, nc.aceito_em))), criacao_ate_decisao: timeSummary(all.filter((nc) => inPeriod(nc.decidido_em)).map((nc) => seconds(nc.criado_em, nc.decidido_em))) };
  const ranges = new Map([['0-1d',0],['2-3d',0],['4-7d',0],['8+d',0]]); let oldest: Row | null = null; const now = Date.now();
  for (const nc of active) { const since = nc.status === 'aberta' ? nc.criado_em : ['aguardando_aceite', 'nao_respondida'].includes(nc.status) ? (nc.feedback_aplicado_em || nc.validado_em || nc.criado_em) : nc.status === 'em_plano_acao' ? (nc.aceito_em || nc.validado_em || nc.criado_em) : (nc.validado_em || nc.enviado_em || nc.criado_em); const days = Math.floor((now - Date.parse(since)) / 86400000); const range = days < 2 ? '0-1d' : days < 4 ? '2-3d' : days < 8 ? '4-7d' : '8+d'; ranges.set(range, (ranges.get(range) ?? 0) + 1); if (!oldest || days > oldest.dias_na_etapa) oldest = { nc_id:nc.id,status:canonicalStatus(nc.status),dias_na_etapa:days,desde:new Date(since).toISOString() }; }
  const months = new Map(monthKeys(start,end).map((month) => [month,{mes:month,total:0,concluidas:0,invalidadas:0,reincidentes:0}]));
  const collaborators = new Map<string,Row>(), sectors = new Map<string,Row>(), causeTotals = new Map<number,Row>();
  for (const nc of period) { const recurring = (causes.get(nc.id) ?? []).some((cause) => Number(cause.ocorrencia_numero) > 1); const month=months.get((isoDate(nc.data)||isoDate(nc.criado_em))!.slice(0,7)); if(month){month.total++;if(nc.status==='concluida')month.concluidas++;if(nc.status==='invalidada')month.invalidadas++;if(recurring)month.reincidentes++;} const key=nc.colaborador_id||nc.colaborador||'Não informado'; const person=collaborators.get(key)??{colaborador_id:nc.colaborador_id,colaborador:nc.colaborador||'Não informado',setor:nc.setor,total:0,invalidadas:0,reincidencias:0,reincidencias_12m:0,backlog_ativo:0}; person.total++;if(nc.status==='invalidada')person.invalidadas++;if(recurring){person.reincidencias++;person.reincidencias_12m++;}collaborators.set(key,person); const sector=nc.setor||'Não informado';const si=sectors.get(sector)??{setor:sector,total:0,invalidadas:0,backlog_ativo:0,nao_respondidas:0};si.total++;if(nc.status==='invalidada')si.invalidadas++;sectors.set(sector,si); for(const cause of causes.get(nc.id)??[]){const ci=causeTotals.get(cause.causa_id)??{causa_id:cause.causa_id,causa:cause.descricao||`Causa ${cause.causa_id}`,total:0,total_reincidentes:0,ocorrencias:0,reincidencias_12m:0};ci.total++;if(COUNTABLE.has(nc.status)){ci.ocorrencias++;if(Number(cause.ocorrencia_numero)>1){ci.total_reincidentes++;ci.reincidencias_12m++;}}causeTotals.set(cause.causa_id,ci);}}
  for(const nc of active){const key=nc.colaborador_id||nc.colaborador||'Não informado';const person=collaborators.get(key)??{colaborador_id:nc.colaborador_id,colaborador:nc.colaborador||'Não informado',setor:nc.setor,total:0,invalidadas:0,reincidencias:0,reincidencias_12m:0,backlog_ativo:0};person.backlog_ativo++;collaborators.set(key,person);const sector=nc.setor||'Não informado';const si=sectors.get(sector)??{setor:sector,total:0,invalidadas:0,backlog_ativo:0,nao_respondidas:0};si.backlog_ativo++;if(nc.status==='nao_respondida')si.nao_respondidas++;sectors.set(sector,si);}
  const disciplineApplied=new Map<string,number>(), disciplineSuggested=new Map<string,number>(), suggestions=new Map<number,Row>(), measuresByCause=new Map<number,Row>();
  for(const measure of measures??[]){if(measure.status!=='aplicada')continue;const date=isoDate(measure.data_aplicacao)||isoDate(measure.criado_em);if(!date||date<start||date>end)continue;inc(disciplineApplied,measure.tipo);const ci=measuresByCause.get(measure.causa_id)??{causa_id:measure.causa_id,causa:causeTotals.get(measure.causa_id)?.causa||`Causa ${measure.causa_id}`,advertencias:0,suspensoes:0,avaliacoes_justa_causa:0,total:0};ci.total++;if(measure.tipo==='advertencia')ci.advertencias++;else if(measure.tipo==='suspensao')ci.suspensoes++;else ci.avaliacoes_justa_causa++;measuresByCause.set(measure.causa_id,ci);}
  for(const nc of period.filter((item)=>COUNTABLE.has(item.status)))for(const cause of causes.get(nc.id)??[]){const suggestion=suggestedMeasure(Number(cause.ocorrencia_numero));if(!suggestion)continue;inc(disciplineSuggested,suggestion);const si=suggestions.get(cause.causa_id)??{causa_id:cause.causa_id,causa:cause.descricao||`Causa ${cause.causa_id}`,advertencias_sugeridas:0,suspensoes_sugeridas:0,avaliacoes_justa_causa_sugeridas:0,total_sugestoes:0};si.total_sugestoes++;if(suggestion==='advertencia')si.advertencias_sugeridas++;else if(suggestion==='suspensao')si.suspensoes_sugeridas++;else si.avaliacoes_justa_causa_sugeridas++;suggestions.set(cause.causa_id,si);}
  const criticities=new Map<string,number>();period.forEach((nc)=>inc(criticities,nc.criticidade||'Não informada'));
  return {
    versao_contrato: "insights-v2",
    periodo: { inicio: start, fim: end },
    escopo: { tipo: teamIds === null ? "global" : "equipe_hierarquica", quantidade_colaboradores: teamIds?.length ?? null },
    metodologia: {
      volume: "NCs cuja data efetiva de abertura está dentro do período.",
      backlog: "Fotografia atual de todas as NCs ativas do escopo, independentemente da data de abertura.",
      tempos: "Cada amostra pertence ao período pelo timestamp da transição final medida.",
      reincidencia: "Mesmo colaborador + mesma causa; snapshot ocorrencia_numero > 1 na janela móvel de 12 meses.",
    },
    kpis,
    tempos: durations,
    aged_backlog: {
      total: active.length,
      faixas: [...ranges].map(([faixa, quantidade]) => ({ faixa, quantidade })),
      por_status: STATUS_ORDER.slice(0, 4)
        .filter((status) => count(backlogStatus, status))
        .map((status) => ({ status, quantidade: count(backlogStatus, status) })),
      mais_antiga: oldest,
    },
    ncs_por_mes: [...months.values()],
    ncs_por_status: STATUS_ORDER
      .filter((status) => count(periodStatus, status))
      .map((status) => ({ status, quantidade: count(periodStatus, status) })),
    ncs_por_colaborador: [...collaborators.values()].sort((a, b) => b.total - a.total || b.backlog_ativo - a.backlog_ativo),
    ncs_por_setor: [...sectors.values()].sort((a, b) => b.total - a.total || b.backlog_ativo - a.backlog_ativo),
    ncs_por_criticidade: [...criticities].map(([criticidade, total]) => ({ criticidade, total })).sort((a, b) => b.total - a.total),
    ncs_por_causa: [...causeTotals.values()].map(({ ocorrencias, reincidencias_12m, ...rest }) => rest).sort((a, b) => b.total - a.total),
    reincidencia_por_causa: [...causeTotals.values()]
      .filter((item) => item.ocorrencias)
      .map((item) => ({ causa_id: item.causa_id, causa: item.causa, ocorrencias: item.ocorrencias, reincidencias_12m: item.reincidencias_12m, reincidiu_apos_conclusao: item.reincidencias_12m }))
      .sort((a, b) => b.ocorrencias - a.ocorrencias),
    reincidencia_por_colaborador: [...collaborators.values()]
      .filter((item) => item.reincidencias_12m > 0)
      .map((item) => ({ colaborador_id: item.colaborador_id, colaborador: item.colaborador, setor: item.setor, reincidencias_12m: item.reincidencias_12m, total_ncs: item.total }))
      .sort((a, b) => b.reincidencias_12m - a.reincidencias_12m),
    medidas_por_causa: [...measuresByCause.values()].sort((a, b) => b.total - a.total),
    disciplina: {
      aplicadas: {
        advertencias: count(disciplineApplied, "advertencia"),
        suspensoes: count(disciplineApplied, "suspensao"),
        avaliacoes_justa_causa: count(disciplineApplied, "avaliar_justa_causa"),
        total: [...disciplineApplied.values()].reduce((a, b) => a + b, 0),
      },
      sugeridas: {
        advertencias: count(disciplineSuggested, "advertencia"),
        suspensoes: count(disciplineSuggested, "suspensao"),
        avaliacoes_justa_causa: count(disciplineSuggested, "avaliar_justa_causa"),
        total: [...disciplineSuggested.values()].reduce((a, b) => a + b, 0),
      },
    },
    sugestoes_disciplinares_por_causa: [...suggestions.values()].sort((a, b) => b.total_sugestoes - a.total_sugestoes),
  };
}
