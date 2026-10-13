/** Dados dos relatórios: o recorte (escopo, período e filtros) e o que cada NC precisa para PDF e planilha. */
import "server-only";

import { requireApiUser as requireUser } from "@/lib/auth/api";
import { ApiError } from "@/lib/api/error";
import { ehQualidade } from "@/lib/auth/papeis";
import { buildNcTeamScopeFilter } from "@/lib/permissions/nc-scope";
import { listarPessoasAbaixo } from "@/lib/permissions/team-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { plural, rotuloStatus } from "./formato";
import { STATUS_ATIVOS } from "./regras";

type Row = Record<string, any>;

const canonical = (status: unknown) => ["validada", "aguardando_analise"].includes(String(status)) ? "aguardando_feedback" : String(status ?? "");
const dateOnly = (value: unknown) => String(value ?? "").slice(0, 10);

/** Quem pede o relatório e qual equipe ele enxerga (supervisor: só a própria cadeia). */
export async function reportScope() {
  const user = await requireUser();
  if (!ehQualidade(user.papel) && user.papel !== "supervisor") throw new ApiError("Acesso restrito à Qualidade e às lideranças.", 403);
  const admin = createAdminClient();
  let teamIds: string[] | null = null;
  if (user.papel === "supervisor") teamIds = (await listarPessoasAbaixo(user.id)).map((person) => person.id);
  return { admin, teamIds, user };
}

/** Último feedback estruturado de cada NC, com o nome do responsável pela ação. */
export async function ultimosFeedbacks(ncIds: number[]) {
  const result = new Map<number, Row>();
  if (!ncIds.length) return result;
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from("nc_feedbacks")
    .select("nc_id, versao, causa_raiz, acao_combinada, responsavel_acao_id, prazo_acao, combinado, prazo_aceite, legado, criado_em").in("nc_id", ncIds);
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

const CAMPOS_NC = "id, data, status, colaborador_id, colaborador, setor, criticidade, critica, chamado, descricao, criado_em, enviado_em, validado_em, feedback_aplicado_em, aceito_em, aceito_fora_prazo, decidido_em";

export type Recorte = Awaited<ReturnType<typeof carregarRecorte>>;

/**
 * Recorte do relatório: NCs do período (pela data de abertura) e NCs em andamento hoje,
 * com causas, último feedback, líder direto do colaborador e medidas disciplinares pendentes.
 */
export async function carregarRecorte(params: URLSearchParams, opcoes: { lideres?: boolean } = {}) {
  const { admin, teamIds, user: requester } = await reportScope();
  const end = params.get("fim") || new Date().toISOString().slice(0, 10);
  const endDate = new Date(`${end}T12:00:00Z`); endDate.setUTCFullYear(endDate.getUTCFullYear() - 1);
  const start = params.get("inicio") || endDate.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new ApiError("O período informado é inválido.");
  if (start > end) throw new ApiError("A data de início não pode ser posterior à data de fim.");
  const requestedEmployee = params.get("colaborador_id");
  if (teamIds && requestedEmployee && requestedEmployee !== requester.id && !teamIds.includes(requestedEmployee)) throw new ApiError("O colaborador selecionado está fora da sua hierarquia.", 403);

  let query = admin.from("nao_conformidades").select(CAMPOS_NC);
  if (teamIds) { const scope = buildNcTeamScopeFilter(requester, teamIds); if (scope) query = query.or(scope); }
  const { data, error } = await query;
  if (error) throw new ApiError("Não foi possível gerar o relatório.", 500);

  const status = params.get("status") ? canonical(params.get("status")) : null;
  const sector = params.get("setor")?.trim().toLocaleLowerCase();
  const filtradas = ((data ?? []) as Row[]).filter((nc) => (!status || canonical(nc.status) === status) && (!requestedEmployee || nc.colaborador_id === requestedEmployee) && (!sector || String(nc.setor || "").trim().toLocaleLowerCase() === sector));
  const doPeriodo = filtradas.filter((nc) => { const date = dateOnly(nc.data || nc.criado_em); return date >= start && date <= end; })
    .sort((a, b) => String(b.data || b.criado_em).localeCompare(String(a.data || a.criado_em)) || b.id - a.id);
  const ativas = filtradas.filter((nc) => STATUS_ATIVOS.has(nc.status));
  const ids = [...new Set([...doPeriodo, ...ativas].map((nc) => nc.id))];

  const causas = new Map<number, Row[]>();
  if (ids.length) {
    const { data: relations, error: relationsError } = await admin.from("nc_causas").select("nc_id, causa_id, ocorrencia_numero, causas(descricao)").in("nc_id", ids);
    if (relationsError) throw new ApiError("Não foi possível carregar as causas.", 500);
    for (const relation of relations ?? []) {
      const joined = relation.causas as unknown as { descricao?: string } | null;
      causas.set(relation.nc_id, [...(causas.get(relation.nc_id) ?? []), { causa_id: relation.causa_id, descricao: joined?.descricao ?? `Causa ${relation.causa_id}`, ocorrencia_numero: relation.ocorrencia_numero }]);
    }
  }
  const feedbacks = await ultimosFeedbacks(ids);
  for (const nc of [...doPeriodo, ...ativas]) nc.prazo_aceite = feedbacks.get(nc.id)?.prazo_aceite ?? null;

  let medidas: Row[] = [];
  if (ids.length) {
    const { data: rows, error: medidasError } = await (admin as any).from("medidas_disciplinares").select("id, nc_id, causa_id, colaborador_id, tipo, status, ocorrencia_gatilho, data_aplicacao, criado_em").in("nc_id", ids);
    if (medidasError) throw new ApiError("Não foi possível carregar as medidas disciplinares.", 500);
    const nomesCausa = new Map<number, string>();
    for (const lista of causas.values()) for (const causa of lista) nomesCausa.set(causa.causa_id, causa.descricao);
    medidas = (rows ?? []).map((row: Row) => ({ ...row, causa: nomesCausa.get(row.causa_id) ?? null }));
  }

  const lideres = new Map<string, string>();
  if (opcoes.lideres) {
    const colaboradores = [...new Set(doPeriodo.map((nc) => nc.colaborador_id).filter(Boolean))];
    if (colaboradores.length) {
      const { data: pessoas, error: pessoasError } = await (admin as any).from("usuarios").select("id, supervisor_id").in("id", colaboradores);
      if (pessoasError) throw new ApiError("Não foi possível carregar as lideranças.", 500);
      const chefes = [...new Set((pessoas ?? []).map((pessoa: Row) => pessoa.supervisor_id).filter(Boolean))] as string[];
      const { data: nomes, error: nomesError } = chefes.length ? await admin.from("usuarios").select("id, nome").in("id", chefes) : { data: [], error: null };
      if (nomesError) throw new ApiError("Não foi possível carregar as lideranças.", 500);
      const nomePorId = new Map<string, string>((nomes ?? []).map((pessoa: Row) => [pessoa.id, pessoa.nome] as [string, string]));
      for (const pessoa of pessoas ?? []) if (pessoa.supervisor_id) lideres.set(pessoa.id, nomePorId.get(pessoa.supervisor_id) ?? "");
    }
  }

  return { admin, requester, teamIds, inicio: start, fim: end, doPeriodo, ativas, causas, feedbacks, medidas, lideres };
}

/** Escopo e filtros em texto: quem lê o relatório sabe exatamente o recorte. */
export async function descreverRecorte(params: URLSearchParams, teamIds: string[] | null) {
  const filtros: string[] = [];
  const status = params.get("status"); if (status) filtros.push(`status ${rotuloStatus(status)}`);
  const setor = params.get("setor")?.trim(); if (setor) filtros.push(`setor ${setor}`);
  const colaboradorId = params.get("colaborador_id");
  if (colaboradorId) {
    const { data } = await createAdminClient().from("usuarios").select("nome").eq("id", colaboradorId).maybeSingle();
    filtros.push(`colaborador ${data?.nome ?? "selecionado"}`);
  }
  return {
    escopo: teamIds ? `Sua equipe (${plural(teamIds.length, "pessoa")})` : "Toda a empresa",
    filtros: filtros.length ? filtros.join("; ") : "nenhum",
  };
}

/** Mudanças de etapa das NCs, com o nome de quem fez (o recorte já limita às NCs que o usuário vê por completo). */
export async function carregarHistorico(ncIds: number[]) {
  if (!ncIds.length) return [];
  const admin = createAdminClient();
  const { data, error } = await admin.from("historico_nc").select("nc_id, usuario_id, status_anterior, status_novo, observacao, criado_em").in("nc_id", ncIds);
  if (error) throw new ApiError("Não foi possível carregar a linha do tempo.", 500);
  const ids = [...new Set((data ?? []).map((evento) => evento.usuario_id).filter(Boolean))] as string[];
  const { data: pessoas, error: pessoasError } = ids.length ? await admin.from("usuarios").select("id, nome").in("id", ids) : { data: [], error: null };
  if (pessoasError) throw new ApiError("Não foi possível carregar a linha do tempo.", 500);
  const nomes = new Map<string, string>((pessoas ?? []).map((pessoa: Row) => [pessoa.id, pessoa.nome] as [string, string]));
  return (data ?? [])
    .map((evento: Row) => ({ ...evento, autor_nome: evento.usuario_id ? nomes.get(evento.usuario_id) ?? "Usuário removido" : "Sistema" }))
    .sort((a: Row, b: Row) => b.nc_id - a.nc_id || String(a.criado_em).localeCompare(String(b.criado_em)));
}
