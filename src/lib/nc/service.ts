import { filterSensitive } from "@/lib/permissions/nc";
import { podeAtuarComoQualidade } from "@/lib/permissions/plano-acao";
import { buildNcReadScopeFilter } from "@/lib/permissions/nc-scope";
import { listarPessoasAbaixo, validarAcessoPessoa } from "@/lib/permissions/team-scope";
import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ehQualidade } from "@/lib/auth/papeis";
import type { UsuarioAutenticado } from "@/lib/auth/types";
import { eventosDaTimeline, type AutorTimeline } from "@/lib/nc/timeline";
import { listaFiltroIn, chaveCatalogoCausa, resolverCausasDoCatalogo } from "@/lib/nc/causasCatalogo";

const TEXTO_ACEITE = "li e concordo com a não conformidade e com o feedback aplicado";

type NcInput = {
  data?: unknown;
  chamado?: unknown;
  colaborador_id?: unknown;
  criticidade?: unknown;
  descricao?: unknown;
  causas?: unknown;
};


async function requireAdmin() {
  const user = await requireUser();
  if (!ehQualidade(user.papel)) {
    throw new ApiError("Apenas a Qualidade pode fazer isso.", 403);
  }
  return user;
}

export const MENSAGEM_CONFLITO = "Você é o colaborador analisado nesta NC. Outra pessoa da Qualidade deve conduzir esta etapa.";

/** Qualidade, desde que não seja o colaborador analisado (conflito de interesses). */
async function requireQualidadeSemConflito(id: number) {
  const user = await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("nao_conformidades").select("id, colaborador_id").eq("id", id).maybeSingle();
  if (error) throw new ApiError("Não foi possível carregar a NC.", 500);
  if (!data) throw new ApiError("NC não encontrada.", 404);
  if (!podeAtuarComoQualidade(data, user)) throw new ApiError(MENSAGEM_CONFLITO, 403);
  return user;
}

export function normalizeRpc(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  if (Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  return {};
}

function transitionError(result: Record<string, unknown>): never {
  if (result.erro === "nc_nao_encontrada") throw new ApiError("NC não encontrada.", 404);
  if (result.erro === "conflito_interesse") throw new ApiError(MENSAGEM_CONFLITO, 403);
  if (result.erro === "colaborador_ausente") {
    throw new ApiError("Defina o colaborador analisado antes de validar a NC.");
  }
  if (result.erro === "colaborador_incorreto") {
    throw new ApiError("Somente o colaborador analisado pode registrar o aceite.", 403);
  }
  if (result.erro === "motivo_ausente") throw new ApiError("Informe o motivo da invalidação.");
  if (result.erro === "feedback_ausente") throw new ApiError("Informe o feedback.");
  if (result.erro === "nc_nao_aberta" || result.erro === "status_invalido") {
    throw new ApiError("A NC já foi alterada por outro processo.", 409);
  }
  throw new ApiError("Não foi possível concluir a transição da NC.", 500);
}

function parseInput(input: NcInput) {
  const causas = Array.isArray(input.causas)
    ? [...new Set(input.causas.map((item) => String(item).trim()).filter(Boolean))]
    : [];
  return {
    data: input.data ? String(input.data) : null,
    chamado: input.chamado ? String(input.chamado).trim() : null,
    colaborador_id: input.colaborador_id ? String(input.colaborador_id) : null,
    criticidade: String(input.criticidade ?? "Baixa"),
    descricao: input.descricao ? String(input.descricao).trim() : null,
    causas,
  };
}

async function causeIds(
  causas: string[],
  options: { allowInactive?: boolean } = {},
) {
  // Causas só entram pelo catálogo (/causas): abertura e edição de NC nunca criam causa.
  if (!causas.length) return [] as number[];
  const normalizadas = [...new Set(causas.map(chaveCatalogoCausa))];
  const { data, error } = await (createAdminClient() as any).from("causas")
    .select("id, ativo, descricao_normalizada").filter("descricao_normalizada", "in", listaFiltroIn(normalizadas));
  if (error) throw new ApiError("Não foi possível validar o catálogo de causas.", 500);
  return resolverCausasDoCatalogo(causas, data ?? [], options);
}

async function collaborator(id: string | null) {
  if (!id) return null;
  const { data, error } = await createAdminClient()
    .from("usuarios")
    .select("nome, setor")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new ApiError("Colaborador informado não existe.", 400, "colaborador");
  return data;
}

async function addCauses<T extends { id: number }>(rows: T[]) {
  if (!rows.length) return rows.map((row) => ({ ...row, causas: [] as string[] }));
  const ids = rows.map((row) => row.id);
  const { data, error } = await createAdminClient()
    .from("nc_causas")
    .select("nc_id, causas(descricao)")
    .in("nc_id", ids);
  if (error) throw new ApiError("Não foi possível carregar as causas da NC.", 500);
  const byNc = new Map<number, string[]>();
  for (const item of data ?? []) {
    const joined = item.causas as unknown as { descricao?: string } | null;
    if (!joined?.descricao) continue;
    byNc.set(item.nc_id, [...(byNc.get(item.nc_id) ?? []), joined.descricao]);
  }
  return rows.map((row) => ({ ...row, causas: byNc.get(row.id) ?? [] }));
}

function secondsBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const value = Math.floor((Date.parse(end) - Date.parse(start)) / 1000);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function durations(nc: Record<string, unknown>) {
  const status = String(nc.status ?? "");
  const criado = nc.criado_em as string | null;
  const validado = nc.validado_em as string | null;
  const feedback = nc.feedback_aplicado_em as string | null;
  const aceito = nc.aceito_em as string | null;
  const decidido = nc.decidido_em as string | null;
  let currentStart: string | null = null;
  if (status === "aberta") currentStart = criado;
  else if (["validada", "aguardando_analise", "aguardando_feedback"].includes(status)) {
    currentStart = validado ?? (nc.enviado_em as string | null) ?? criado;
  } else if (status === "aguardando_aceite") currentStart = feedback ?? validado ?? criado;
  else if (status === "em_plano_acao") currentStart = aceito ?? (nc.critica_marcada_em as string | null) ?? criado;
  return {
    criacao_ate_validacao_segundos: secondsBetween(criado, validado),
    validacao_ate_feedback_segundos: secondsBetween(validado, feedback),
    feedback_ate_aceite_segundos: secondsBetween(feedback, aceito),
    ciclo_total_segundos: secondsBetween(criado, aceito),
    criacao_ate_decisao_segundos: secondsBetween(criado, decidido),
    etapa_atual: currentStart ? status : null,
    etapa_atual_desde: currentStart,
    tempo_etapa_atual_segundos: secondsBetween(currentStart, new Date().toISOString()),
  };
}


/** Liderados diretos e indiretos do supervisor; vazio para os demais papéis. */
async function equipeDoUsuario(user: Awaited<ReturnType<typeof requireUser>>) {
  if (user.papel !== "supervisor") return [] as string[];
  return (await listarPessoasAbaixo(user.id)).map((member) => member.id);
}

export async function listarNcs() {
  const user = await requireUser();
  const admin = createAdminClient();
  let query = admin.from("nao_conformidades").select("*");
  const teamIds = await equipeDoUsuario(user);
  if (!ehQualidade(user.papel)) {
    const scope = buildNcReadScopeFilter(user, teamIds);
    if (scope) query = query.or(scope);
  }
  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) throw new ApiError("Não foi possível carregar as não conformidades.", 500);
  const rows = await addCauses((data ?? []) as Array<{ id: number }>);
  const equipe = new Set(teamIds);
  return rows.map((nc) => filterSensitive(nc, user, equipe));
}

export async function listarMinhasNcs() {
  const user = await requireUser();
  const admin = createAdminClient();
  let query = admin.from("nao_conformidades").select("*");
  if (!ehQualidade(user.papel)) {
    const scope = buildNcReadScopeFilter(user, []);
    if (scope) query = query.or(scope);
  }
  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) throw new ApiError("Não foi possível carregar suas não conformidades.", 500);
  const rows = await addCauses((data ?? []) as Array<{ id: number }>);
  const equipe = new Set(await equipeDoUsuario(user));
  return rows.map((nc) => filterSensitive(nc, user, equipe));
}

/** `usuario` evita repetir sessão + leitura do usuário quando quem chama já o carregou. */
export async function buscarNc(id: number, usuario?: UsuarioAutenticado) {
  const user = usuario ?? await requireUser();
  const admin = createAdminClient();
  let query = admin.from("nao_conformidades").select("*").eq("id", id);
  const teamIds = await equipeDoUsuario(user);
  if (!ehQualidade(user.papel)) {
    const scope = buildNcReadScopeFilter(user, teamIds);
    if (scope) query = query.or(scope);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new ApiError("NC não encontrada.", 404);
  const [withCauses] = await addCauses([data]);
  const filtered = filterSensitive(withCauses, user, new Set(teamIds));
  return { ...filtered, duracoes: durations(filtered) };
}

export async function listarNcsDaPessoa(
  pessoaId: string,
  options: { pagina?: number; status?: string | null; inicio?: string | null; fim?: string | null } = {},
) {
  const user = await requireUser();
  await validarAcessoPessoa(user, pessoaId);
  const paginaInformada = Number(options.pagina ?? 0);
  const pagina = Number.isFinite(paginaInformada) ? Math.max(0, Math.min(10_000, Math.floor(paginaInformada))) : 0;
  const pageSize = 25;
  const status = options.status?.trim() || null;
  const inicio = options.inicio?.trim() || null;
  const fim = options.fim?.trim() || null;
  const validStatuses = ["aberta", "aguardando_feedback", "aguardando_analise", "validada", "aguardando_aceite", "em_plano_acao", "concluida", "invalidada"];
  if (status && !validStatuses.includes(status)) throw new ApiError("O status selecionado é inválido.", 422);
  const isDate = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  if ((inicio || fim) && (!isDate(inicio) || !isDate(fim))) throw new ApiError("Informe o período completo para filtrar as NCs.", 422);
  if (inicio && fim && inicio > fim) throw new ApiError("A data inicial não pode ser posterior à data final.", 422);

  const admin = createAdminClient();
  let query = admin.from("nao_conformidades").select("*", { count: "exact" }).eq("colaborador_id", pessoaId);
  const teamIds = await equipeDoUsuario(user);
  if (!ehQualidade(user.papel)) {
    const scope = buildNcReadScopeFilter(user, teamIds);
    if (scope) query = query.or(scope);
  }
  if (status) query = query.eq("status", status);
  if (inicio && fim) query = query.gte("data", inicio).lte("data", fim);

  const { data, count, error } = await query
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .range(pagina * pageSize, pagina * pageSize + pageSize - 1);
  if (error) throw new ApiError("Não foi possível carregar as NCs deste colaborador.", 500);
  const rows = await addCauses((data ?? []) as Array<{ id: number }>);
  return {
    items: rows.map((nc) => filterSensitive(nc, user, new Set(teamIds))),
    total: count ?? rows.length,
    pagina,
    por_pagina: pageSize,
  };
}

export async function listarCausas() {
  await requireUser();
  const client = await createClient();
  const { data, error } = await (client as any)
    .from("causas").select("descricao").eq("ativo", true).order("descricao");
  if (error) throw new ApiError("Não foi possível carregar as causas.", 500);
  return (data ?? []).map((item) => item.descricao);
}

export async function solicitarCausa(input: { descricao?: unknown; justificativa?: unknown }) {
  const user = await requireUser();
  if (ehQualidade(user.papel)) throw new ApiError("A Qualidade pode cadastrar causas diretamente.", 403);
  const descricao = String(input.descricao ?? "").trim().replace(/\s+/g, " ");
  const justificativa = String(input.justificativa ?? "").trim();
  if (descricao.length < 3 || descricao.length > 120) throw new ApiError("A causa deve ter entre 3 e 120 caracteres.", 422);
  if (justificativa.length < 10 || justificativa.length > 1000) throw new ApiError("A justificativa deve ter entre 10 e 1.000 caracteres.", 422);
  const admin = createAdminClient() as any;
  const normalized = descricao.toLocaleLowerCase("pt-BR");
  const { data: cause, error: causeError } = await admin.from("causas").select("id, ativo").eq("descricao_normalizada", normalized).maybeSingle();
  if (causeError) throw new ApiError("Não foi possível validar o catálogo de causas.", 500);
  if (cause?.ativo) throw new ApiError("Esta causa já está aprovada no catálogo.", 409);
  const { data: pending, error: pendingError } = await admin.from("solicitacoes_causa")
    .select("id").eq("descricao_normalizada", normalized).eq("status", "pendente").maybeSingle();
  if (pendingError) throw new ApiError("Não foi possível validar solicitações existentes.", 500);
  if (pending) throw new ApiError("Já existe uma solicitação pendente para esta causa.", 409);
  const { data, error } = await admin.from("solicitacoes_causa")
    .insert({ descricao, justificativa, solicitado_por: user.id }).select("id, status, solicitado_em").single();
  if (error?.code === "23505") throw new ApiError("Já existe uma solicitação pendente para esta causa.", 409);
  if (error || !data) throw new ApiError("Não foi possível enviar a solicitação da causa.", 500);
  return data;
}

export async function listarSolicitacoesCausa() {
  await requireAdmin();
  const admin = createAdminClient() as any;
  const [{ data: requests, error }, { data: causes, error: causesError }] = await Promise.all([
    admin.from("solicitacoes_causa").select("id, descricao, justificativa, solicitado_por, solicitado_em")
      .eq("status", "pendente").order("solicitado_em", { ascending: true }),
    admin.from("causas").select("id, descricao").eq("ativo", true).order("descricao"),
  ]);
  if (error || causesError) throw new ApiError("Não foi possível carregar a fila de causas.", 500);
  const ids = [...new Set((requests ?? []).map((item: { solicitado_por: string }) => item.solicitado_por))];
  const { data: people, error: peopleError } = ids.length
    ? await admin.from("usuarios").select("id, nome").in("id", ids) : { data: [], error: null };
  if (peopleError) throw new ApiError("Não foi possível identificar os solicitantes.", 500);
  const names = new Map((people ?? []).map((item: { id: string; nome: string }) => [item.id, item.nome]));
  return { solicitacoes: (requests ?? []).map((item: Record<string, unknown>) => ({
    ...item, solicitante_nome: names.get(item.solicitado_por as string) ?? "Usuário",
  })), causas: causes ?? [] };
}

function validarCausaId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError("Causa inválida.", 422);
}

function normalizarDescricaoCausa(input: unknown) {
  const descricao = String(input ?? "").trim().replace(/\s+/g, " ");
  if (descricao.length < 3 || descricao.length > 120) {
    throw new ApiError("A descrição deve conter entre 3 e 120 caracteres.", 422);
  }
  return descricao;
}

export async function listarCausasGestao() {
  await requireAdmin();
  const admin = createAdminClient() as any;
  const { data: causas, error } = await admin.from("causas")
    .select("id, descricao, ativo").order("ativo", { ascending: false }).order("descricao");
  if (error) throw new ApiError("Não foi possível carregar o catálogo de causas.", 500);
  const ids = (causas ?? []).map((causa: { id: number }) => causa.id);
  const { data: vinculos, error: vinculosError } = ids.length
    ? await admin.from("nc_causas").select("causa_id").in("causa_id", ids)
    : { data: [], error: null };
  if (vinculosError) throw new ApiError("Não foi possível verificar as NCs vinculadas às causas.", 500);
  const contagens = new Map<number, number>();
  for (const vinculo of vinculos ?? []) contagens.set(vinculo.causa_id, (contagens.get(vinculo.causa_id) ?? 0) + 1);
  return (causas ?? []).map((causa: { id: number; descricao: string; ativo: boolean }) => ({
    ...causa,
    ncs_vinculadas: contagens.get(causa.id) ?? 0,
  }));
}

export async function criarCausaCatalogo(input: { descricao?: unknown }) {
  const user = await requireAdmin();
  const descricao = normalizarDescricaoCausa(input.descricao);
  const { data, error } = await (createAdminClient() as any).from("causas")
    .insert({ descricao, criado_por: user.id, ativo: true }).select("id, descricao, ativo").single();
  if (error?.code === "23505") throw new ApiError("Já existe uma causa com essa descrição.", 409);
  if (error || !data) throw new ApiError("Não foi possível cadastrar a causa.", 500);
  return { ...data, ncs_vinculadas: 0 };
}

export async function atualizarCausaCatalogo(id: number, input: { descricao?: unknown }) {
  await requireAdmin();
  validarCausaId(id);
  const descricao = normalizarDescricaoCausa(input.descricao);
  const { data, error } = await (createAdminClient() as any).from("causas")
    .update({ descricao }).eq("id", id).select("id, descricao, ativo").maybeSingle();
  if (error?.code === "23505") throw new ApiError("Já existe uma causa com essa descrição.", 409);
  if (error) throw new ApiError("Não foi possível atualizar a causa.", 500);
  if (!data) throw new ApiError("Causa não encontrada.", 404);
  return data;
}

export async function definirCausaAtiva(id: number, ativo: boolean) {
  await requireAdmin();
  validarCausaId(id);
  const { data, error } = await (createAdminClient() as any).from("causas")
    .update({ ativo }).eq("id", id).select("id, descricao, ativo").maybeSingle();
  if (error?.code === "23505") throw new ApiError("Já existe uma causa com essa descrição.", 409);
  if (error) throw new ApiError("Não foi possível atualizar a situação da causa.", 500);
  if (!data) throw new ApiError("Causa não encontrada.", 404);
  return data;
}

export async function excluirCausaCatalogo(id: number) {
  await requireAdmin();
  validarCausaId(id);
  const admin = createAdminClient() as any;
  const { count, error: vinculosError } = await admin.from("nc_causas")
    .select("causa_id", { count: "exact", head: true }).eq("causa_id", id);
  if (vinculosError) throw new ApiError("Não foi possível verificar o histórico da causa.", 500);
  if ((count ?? 0) > 0) throw new ApiError("Esta causa possui NCs vinculadas. Arquive-a para preservar o histórico.", 409);
  const { data, error } = await admin.from("causas").delete().eq("id", id).select("id").maybeSingle();
  if (error?.code === "23503") throw new ApiError("Esta causa recebeu uma NC vinculada. Ela foi mantida para preservar o histórico.", 409);
  if (error) throw new ApiError("Não foi possível excluir a causa.", 500);
  if (!data) throw new ApiError("Causa não encontrada.", 404);
  return { id: data.id, excluida: true };
}

export async function decidirSolicitacaoCausa(id: number, input: { decisao?: unknown; observacao?: unknown; causa_existente_id?: unknown }) {
  const user = await requireAdmin();
  const decisao = String(input.decisao ?? "");
  if (!["aprovar", "rejeitar"].includes(decisao)) throw new ApiError("Decisão inválida.", 422);
  const observacao = String(input.observacao ?? "").trim() || null;
  if (decisao === "rejeitar" && (!observacao || observacao.length < 3)) throw new ApiError("Informe o motivo da rejeição.", 422);
  const causeId = input.causa_existente_id == null || input.causa_existente_id === "" ? null : Number(input.causa_existente_id);
  if (causeId !== null && (!Number.isSafeInteger(causeId) || causeId < 1)) throw new ApiError("A causa existente selecionada é inválida.", 422);
  const { data, error } = await (createAdminClient() as any).rpc("decidir_solicitacao_causa", {
    p_solicitacao_id: id, p_decisor_id: user.id, p_decisao: decisao,
    p_observacao: observacao, p_causa_existente_id: causeId,
  });
  if (error) throw new ApiError("Não foi possível decidir a solicitação da causa.", 500);
  const result = normalizeRpc(data);
  if (!result.ok) throw new ApiError("A solicitação já foi decidida ou os dados não são válidos.", result.erro === "solicitacao_ja_decidida" ? 409 : 422);
  return result;
}

export async function criarNc(input: NcInput) {
  const user = await requireUser();
  const data = parseInput(input);
  if (!data.colaborador_id) throw new ApiError("Selecione o colaborador sobre quem é a Não Conformidade.", 422, "colaborador");
  if (!data.descricao) throw new ApiError("Descreva o que aconteceu.", 422, "descricao");
  if (!["Baixa", "Média", "Alta"].includes(data.criticidade)) throw new ApiError("Selecione uma criticidade válida.", 422, "criticidade");
  const [ids, employee] = await Promise.all([causeIds(data.causas), collaborator(data.colaborador_id)]);
  const admin = createAdminClient();
  const { data: rpcData, error } = await admin.rpc("criar_nc_com_historico_v3", {
    p_data: data.data,
    p_chamado: data.chamado,
    p_setor: employee?.setor ?? null,
    p_colaborador: employee?.nome ?? null,
    p_colaborador_id: data.colaborador_id,
    p_criticidade: data.criticidade,
    p_descricao: data.descricao,
    p_aberto_por: user.id,
    p_setor_responsavel: employee?.setor ?? null,
    p_causa_ids: ids,
  });
  if (error) throw new ApiError("Não foi possível abrir a não conformidade.", 500);
  const result = normalizeRpc(rpcData);
  if (!result.ok) transitionError(result);
  return buscarNc(Number(result.nc_id), user);
}

export async function editarNc(id: number, input: NcInput) {
  const user = await requireQualidadeSemConflito(id);
  const data = parseInput(input);
  const [ids, employee] = await Promise.all([causeIds(data.causas, { allowInactive: true }), collaborator(data.colaborador_id)]);
  const { data: rpcData, error } = await createAdminClient().rpc("editar_nc_v3", {
    p_nc_id: id,
    p_data: data.data,
    p_chamado: data.chamado,
    p_setor: employee?.setor ?? null,
    p_colaborador: employee?.nome ?? null,
    p_colaborador_id: data.colaborador_id,
    p_criticidade: data.criticidade,
    p_descricao: data.descricao,
    p_setor_responsavel: employee?.setor ?? null,
    p_causa_ids: ids,
  });
  if (error) throw new ApiError("Não foi possível editar a NC.", 500);
  const result = normalizeRpc(rpcData);
  if (!result.ok) transitionError(result);
  return buscarNc(id, user);
}

export async function excluirNc(id: number) {
  await requireQualidadeSemConflito(id);
  const admin = createAdminClient();
  const { data: nc, error: ncError } = await admin
    .from("nao_conformidades").select("critica").eq("id", id).maybeSingle();
  if (ncError) throw new ApiError("Não foi possível carregar a NC.", 500);
  const { count, error: planoError } = await (admin as any).from("planos_acao")
    .select("id", { count: "exact", head: true }).eq("nc_id", id);
  if (planoError) throw new ApiError("Não foi possível verificar o plano de ação da NC.", 500);
  if ((nc as { critica?: boolean } | null)?.critica || (count ?? 0) > 0) {
    throw new ApiError("Esta NC possui plano de ação registrado e não pode ser excluída, para preservar a auditoria.", 409);
  }
  const { error } = await createAdminClient().from("nao_conformidades").delete().eq("id", id);
  if (error) throw new ApiError("Não foi possível excluir a NC.", 500);
  return { status: "excluida" };
}

async function rpcTransition(name: string, params: Record<string, unknown>) {
  const { data, error } = await createAdminClient().rpc(name, params);
  if (error) throw new ApiError("Não foi possível concluir a transição da NC.", 500);
  const result = normalizeRpc(data);
  if (!result.ok) transitionError(result);
  return result;
}

export async function avaliarNc(id: number, input: { decisao?: unknown; motivo_invalidacao?: unknown }) {
  const user = await requireQualidadeSemConflito(id);
  const decisao = String(input.decisao ?? "");
  if (!['validar', 'invalidar'].includes(decisao)) throw new ApiError("decisao deve ser 'validar' ou 'invalidar'.");
  if (decisao === "invalidar") {
    const motivo = String(input.motivo_invalidacao ?? "").trim();
    if (!motivo) throw new ApiError("Informe o motivo da invalidação.");
    await rpcTransition("invalidar_nc_v3", { p_nc_id: id, p_responsavel_id: user.id, p_motivo: motivo });
    return buscarNc(id, user);
  }
  const result = await rpcTransition("validar_nc_com_workflow_v3", { p_nc_id: id, p_responsavel_id: user.id });
  const response = await buscarNc(id, user);
  const ocorrencias = Array.isArray(result.ocorrencias)
    ? result.ocorrencias.map((item) => {
        const occurrence = item as Record<string, unknown>;
        const number = Number(occurrence.ocorrencia_numero ?? 0);
        return { ...occurrence, medida_sugerida: suggestedMeasure(number) };
      })
    : [];
  return { ...response, ocorrencias };
}

function suggestedMeasure(occurrence: number) {
  if (occurrence <= 3) return null;
  const cyclePosition = occurrence - 3;
  if ((cyclePosition - 1) % 3 !== 0) return null;
  const measureNumber = Math.floor((cyclePosition - 1) / 3) + 1;
  if (measureNumber <= 3) return "advertencia";
  if (measureNumber <= 6) return "suspensao";
  return "avaliar_justa_causa";
}

export async function obterTimeline(id: number) {
  const user = await requireUser();
  const nc = (await buscarNc(id, user)) as Record<string, unknown>;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("historico_nc")
    .select("id, usuario_id, status_anterior, status_novo, observacao, criado_em")
    .eq("nc_id", id)
    .order("criado_em");
  if (error) throw new ApiError("Não foi possível carregar o histórico da NC.", 500);
  const ids = [...new Set((data ?? []).map((evento) => evento.usuario_id).filter((valor): valor is string => !!valor))];
  const { data: pessoas, error: pessoasError } = ids.length
    ? await admin.from("usuarios").select("id, nome, papel").in("id", ids)
    : { data: [], error: null };
  if (pessoasError) throw new ApiError("Não foi possível identificar os autores do histórico.", 500);
  const autores = new Map<string, AutorTimeline>(
    ((pessoas ?? []) as AutorTimeline[]).map((pessoa) => [pessoa.id, pessoa]),
  );
  // buscarNc já calcula o acesso considerando a hierarquia real do supervisor.
  const eventos = eventosDaTimeline(data ?? [], autores, user.id, nc.acesso_completo === true);
  return { nc_id: id, status_atual: nc.status, duracoes: nc.duracoes, eventos };
}

type DisciplinaryMeasureInput = {
  causa_id?: unknown;
  nc_id?: unknown;
  ocorrencia_gatilho?: unknown;
  tipo?: unknown;
  dias_suspensao?: unknown;
  observacao?: unknown;
};

export async function registrarMedidaDisciplinar(input: DisciplinaryMeasureInput) {
  const user = await requireAdmin();
  const ncId = Number(input.nc_id);
  const causeId = Number(input.causa_id);
  const occurrence = Number(input.ocorrencia_gatilho);
  const type = String(input.tipo ?? "");
  const allowed = ["advertencia", "suspensao", "avaliar_justa_causa"];
  if (!Number.isInteger(ncId) || !Number.isInteger(causeId) || !Number.isInteger(occurrence)) {
    throw new ApiError("NC, causa e ocorrência devem ser informadas.");
  }
  if (!allowed.includes(type)) throw new ApiError("Tipo de medida disciplinar inválido.");
  if (occurrence < 4) throw new ApiError("Não é possível registrar medida disciplinar antes da quarta ocorrência.");
  const suspensionDays = input.dias_suspensao == null ? null : Number(input.dias_suspensao);
  if (type === "suspensao" && (!Number.isInteger(suspensionDays) || suspensionDays! < 1 || suspensionDays! > 30)) {
    throw new ApiError("A suspensão deve possuir entre 1 e 30 dias.");
  }
  if (type !== "suspensao" && suspensionDays !== null) {
    throw new ApiError("A quantidade de dias só deve ser informada para medidas do tipo suspensão.");
  }
  const admin = createAdminClient();
  const { data: nc, error: ncError } = await admin
    .from("nao_conformidades").select("id, colaborador_id").eq("id", ncId).maybeSingle();
  if (ncError || !nc) throw new ApiError("Não conformidade não encontrada.", 404);
  if (!nc.colaborador_id) throw new ApiError("A não conformidade não possui um colaborador associado.");
  if (!podeAtuarComoQualidade(nc, user)) throw new ApiError(MENSAGEM_CONFLITO, 403);
  const { data: relation, error: relationError } = await admin
    .from("nc_causas").select("causa_id, ocorrencia_numero")
    .eq("nc_id", ncId).eq("causa_id", causeId).maybeSingle();
  if (relationError || !relation) throw new ApiError("A causa informada não pertence à não conformidade.");
  if (relation.ocorrencia_numero != null && Number(relation.ocorrencia_numero) !== occurrence) {
    throw new ApiError("A ocorrência informada não corresponde à ocorrência registrada para esta causa.");
  }
  const { data: existing, error: existingError } = await admin
    .from("medidas_disciplinares").select("id").eq("nc_id", ncId)
    .eq("causa_id", causeId).eq("ocorrencia_gatilho", occurrence).maybeSingle();
  if (existingError) throw new ApiError("Não foi possível verificar a medida disciplinar.", 500);
  if (existing) throw new ApiError("Já existe uma medida registrada para esta NC, causa e ocorrência.", 409);
  const { data, error } = await admin.from("medidas_disciplinares").insert({
    colaborador_id: nc.colaborador_id,
    causa_id: causeId,
    nc_id: ncId,
    ocorrencia_gatilho: occurrence,
    tipo: type,
    status: "aplicada",
    dias_suspensao: suspensionDays,
    aplicada_por: user.id,
    observacao: input.observacao ? String(input.observacao).trim() || null : null,
  }).select("*").single();
  if (error || !data) throw new ApiError("Não foi possível registrar a medida disciplinar.", 500);
  return data;
}

export async function aplicarFeedback(id: number, input: { feedback?: unknown }) {
  const user = await requireQualidadeSemConflito(id);
  const feedback = String(input.feedback ?? "").trim();
  if (!feedback) throw new ApiError("Informe o feedback.");
  await rpcTransition("aplicar_feedback_nc_v3", { p_nc_id: id, p_responsavel_id: user.id, p_feedback: feedback });
  return buscarNc(id, user);
}

export async function aceitarNc(id: number, input: { texto_aceite?: unknown }) {
  const user = await requireUser();
  const texto = String(input.texto_aceite ?? "");
  if (texto.trim().toLowerCase().replace(/\s+/g, " ") !== TEXTO_ACEITE) {
    throw new ApiError(`Para confirmar, digite exatamente: "${TEXTO_ACEITE}"`);
  }
  const current = await buscarNc(id, user) as Record<string, unknown>;
  if (current.colaborador_id !== user.id) {
    throw new ApiError("Somente o colaborador analisado pode registrar o aceite.", 403);
  }
  await rpcTransition("aceitar_nc_v3", { p_nc_id: id, p_colaborador_id: user.id, p_texto_aceite: texto });
  return buscarNc(id, user);
}
