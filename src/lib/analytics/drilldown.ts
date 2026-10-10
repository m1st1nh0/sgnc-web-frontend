import "server-only";

import { ApiError } from "@/lib/api/error";
import { requireApiUser as requireUser } from "@/lib/auth/api";
import { buildNcTeamScopeFilter } from "@/lib/permissions/nc-scope";
import { listarPessoasAbaixo } from "@/lib/permissions/team-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehQualidade } from "@/lib/auth/papeis";

type NcRow = {
  id: number;
  data: string | null;
  status: string;
  colaborador_id: string | null;
  colaborador: string | null;
  setor: string | null;
  criticidade: string | null;
  chamado: string | null;
  criado_em: string;
  atualizado_em: string | null;
  validado_em: string | null;
  feedback_aplicado_em: string | null;
  aceito_em: string | null;
  decidido_em: string | null;
  enviado_em: string | null;
};

const ACTIVE = ["aberta", "aguardando_feedback", "aguardando_aceite", "nao_respondida", "em_plano_acao", "validada", "aguardando_analise"];
const COUNTABLE = ["validada", "aguardando_analise", "aguardando_feedback", "aguardando_aceite", "nao_respondida", "em_plano_acao", "concluida"];
const STATUS_ALIASES: Record<string, string[]> = {
  aguardando_feedback: ["aguardando_feedback", "aguardando_analise", "validada"],
};
const FILTER_STATUS_ALIASES: Record<string, string[]> = {
  aberta: ["aberta"],
  aguardando_feedback: ["aguardando_feedback", "aguardando_analise", "validada"],
  aguardando_aceite: ["aguardando_aceite"],
  nao_respondida: ["nao_respondida"],
  em_plano_acao: ["em_plano_acao"],
  concluida: ["concluida"],
  invalidada: ["invalidada"],
};
const DAY = 86_400_000;

function requiredDate(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new ApiError("O período do indicador é inválido.", 422);
  }
  return value;
}

export async function listarNcsDoIndicador(params: URLSearchParams) {
  const user = await requireUser();
  if (!ehQualidade(user.papel) && user.papel !== "supervisor") throw new ApiError("Acesso restrito à Qualidade e às lideranças.", 403);

  const kind = params.get("tipo") ?? "";
  let inicio = requiredDate(params, "inicio");
  let fim = requiredDate(params, "fim");
  if (inicio > fim) throw new ApiError("A data de início não pode ser posterior à data de fim.", 422);

  const page = Math.max(0, Math.min(10000, Number(params.get("pagina") ?? 0) || 0));
  const pageSize = 25;
  const selectedFilterStatus = params.get("filtro_status");
  const selectedFilterStatuses = selectedFilterStatus ? FILTER_STATUS_ALIASES[selectedFilterStatus] : null;
  if (selectedFilterStatus && !selectedFilterStatuses) throw new ApiError("O status selecionado é inválido.", 422);
  const filterEmployeeId = params.get("filtro_colaborador_id")?.trim() || null;
  const filterSector = params.get("filtro_setor")?.trim() || null;
  const admin = createAdminClient();
  let teamIds: string[] | null = null;
  if (user.papel === "supervisor") {
    const people = await listarPessoasAbaixo(user.id);
    teamIds = people.map((person) => person.id);
  }

  let sinceField = "data";
  let statuses: string[] | null = null;
  let causeId: number | null = null;
  let agingBucket: string | null = null;
  let employeeId: string | null = null;
  let sector: string | null = null;
  let criticality: string | null = null;
  let monthSeries: string | null = null;
  let recordId: number | null = null;

  if (kind === "backlog") {
    statuses = params.get("status") ? (STATUS_ALIASES[params.get("status")!] ?? [params.get("status")!]) : ACTIVE;
    if (params.has("status")) statuses = statuses.filter((status) => ACTIVE.includes(status));
    sinceField = "";
  } else if (kind === "period") {
    // NCs are represented by their opening date on this indicator.
  } else if (kind === "concluded") {
    sinceField = "aceito_em";
    statuses = ["concluida"];
  } else if (kind === "invalidated") {
    sinceField = "decidido_em";
    statuses = ["invalidada"];
  } else if (kind === "aging") {
    agingBucket = params.get("faixa");
    if (!["0-1d", "2-3d", "4-7d", "8+d"].includes(agingBucket ?? "")) throw new ApiError("Faixa de aging inválida.", 422);
    statuses = ACTIVE;
    sinceField = "";
  } else if (kind === "record") {
    recordId = Number(params.get("nc_id"));
    if (!Number.isSafeInteger(recordId) || recordId < 1) throw new ApiError("NC inválida.", 422);
    sinceField = "";
  } else if (kind === "dimension") {
    const dimension = params.get("dimensao");
    if (dimension === "colaborador") {
      employeeId = params.get("colaborador_id");
      if (!employeeId) throw new ApiError("Colaborador inválido.", 422);
    } else if (dimension === "setor") {
      sector = params.get("setor");
      if (!sector) throw new ApiError("Setor inválido.", 422);
    } else if (dimension === "criticidade") {
      criticality = params.get("criticidade");
      if (!criticality) throw new ApiError("Criticidade inválida.", 422);
    } else if (dimension === "causa") {
      causeId = Number(params.get("causa_id"));
      if (!Number.isSafeInteger(causeId) || causeId < 1) throw new ApiError("Causa inválida.", 422);
    } else {
      throw new ApiError("Dimensão de indicador inválida.", 422);
    }
  } else if (kind === "mensal") {
    const month = params.get("mes") ?? "";
    if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiError("Mês inválido.", 422);
    monthSeries = params.get("serie") ?? "total";
    inicio = `${month}-01`;
    const next = new Date(`${inicio}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    fim = new Date(next.getTime() - DAY).toISOString().slice(0, 10);
    if (monthSeries === "concluidas") {
      statuses = ["concluida"];
    } else if (monthSeries === "invalidadas") {
      statuses = ["invalidada"];
    }
  } else {
    throw new ApiError("Indicador inválido.", 422);
  }

  if (teamIds !== null && employeeId && !teamIds.includes(employeeId)) {
    throw new ApiError("Você não tem permissão para consultar este colaborador.", 403);
  }

  let matchingCauseIds: number[] | null = null;
  let occurrenceFilter: "recurrent" | "initial" | null = kind === "mensal" && monthSeries === "reincidentes" ? "recurrent" : null;
  if (causeId !== null) {
    const series = params.get("serie");
    if (["total_reincidentes", "reincidencias_12m", "demais_ocorrencias"].includes(series ?? "")) {
      statuses = COUNTABLE;
    }
    occurrenceFilter = ["total_reincidentes", "reincidencias_12m"].includes(series ?? "")
      ? "recurrent"
      : ["nao_reincidentes", "demais_ocorrencias"].includes(series ?? "")
        ? "initial"
        : null;
    let relations = admin.from("nc_causas").select("nc_id").eq("causa_id", causeId);
    if (occurrenceFilter === "recurrent") relations = relations.gt("ocorrencia_numero", 1);
    if (occurrenceFilter === "initial") relations = relations.lte("ocorrencia_numero", 1);
    const { data, error } = await relations;
    if (error) throw new ApiError("Não foi possível localizar as NCs da causa.", 500);
    matchingCauseIds = [...new Set((data ?? []).map((row) => Number(row.nc_id)))];
  } else if (occurrenceFilter === "recurrent") {
    const { data, error } = await admin.from("nc_causas").select("nc_id").gt("ocorrencia_numero", 1);
    if (error) throw new ApiError("Não foi possível localizar as NCs reincidentes.", 500);
    matchingCauseIds = [...new Set((data ?? []).map((row) => Number(row.nc_id)))];
  }

  if (selectedFilterStatuses) {
    statuses = statuses ? statuses.filter((status) => selectedFilterStatuses.includes(status)) : selectedFilterStatuses;
  }

  let query = admin.from("nao_conformidades").select(
    "id, data, status, colaborador_id, colaborador, setor, criticidade, chamado, criado_em, atualizado_em, validado_em, feedback_aplicado_em, aceito_em, decidido_em, enviado_em",
    { count: "exact" },
  );
  if (teamIds !== null) {
    const scope = buildNcTeamScopeFilter(user, teamIds);
    if (scope) query = query.or(scope);
  }
  if (statuses) query = statuses.length ? query.in("status", [...new Set(statuses)]) : query.in("id", [-1]);
  if (sinceField) query = query.gte(sinceField, inicio).lte(sinceField, fim);
  if (recordId !== null) query = query.eq("id", recordId);
  if (employeeId) query = query.eq("colaborador_id", employeeId);
  if (sector) query = query.eq("setor", sector);
  if (criticality) query = query.eq("criticidade", criticality);
  if (filterEmployeeId) query = query.eq("colaborador_id", filterEmployeeId);
  if (filterSector) query = query.eq("setor", filterSector);
  if (matchingCauseIds) query = matchingCauseIds.length ? query.in("id", matchingCauseIds) : query.in("id", [-1]);

  // Aging buckets are small operational backlogs; their age is derived from the current
  // workflow timestamp, so calculate the exact bucket before paginating.
  if (agingBucket) {
    query = query.order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 9999);
  } else {
    query = query.order("data", { ascending: false }).order("id", { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
  }
  const { data, count: total, error } = await query;
  if (error) throw new ApiError("Não foi possível carregar as NCs do indicador.", 500);
  let rows = (data ?? []) as NcRow[];

  if (agingBucket) {
    rows = rows.filter((row) => {
      const since = row.status === "aberta"
        ? row.criado_em
        : row.status === "aguardando_aceite" || row.status === "nao_respondida"
          ? row.feedback_aplicado_em || row.validado_em || row.criado_em
          : row.status === "em_plano_acao"
            ? row.aceito_em || row.validado_em || row.criado_em
            : row.validado_em || row.enviado_em || row.criado_em;
      const days = Math.max(0, Math.floor((Date.now() - Date.parse(since)) / DAY));
      const bucket = days < 2 ? "0-1d" : days < 4 ? "2-3d" : days < 8 ? "4-7d" : "8+d";
      return bucket === agingBucket;
    });
    const exactTotal = rows.length;
    rows = rows.slice(page * pageSize, page * pageSize + pageSize);
    return { items: rows, total: exactTotal, pagina: page, por_pagina: pageSize };
  }

  return { items: rows, total: total ?? rows.length, pagina: page, por_pagina: pageSize };
}
