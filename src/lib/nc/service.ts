import { filterSensitive } from "@/lib/permissions/nc";
import { buildNcReadScopeFilter } from "@/lib/permissions/nc-scope";
import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  if (user.papel !== "adm") {
    throw new ApiError("Apenas o administrador (Qualidade) pode fazer isso.", 403);
  }
  return user;
}

function normalizeRpc(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  if (Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  return {};
}

function transitionError(result: Record<string, unknown>) {
  if (result.erro === "nc_nao_encontrada") throw new ApiError("NC não encontrada.", 404);
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

async function causeIds(causas: string[], userId: string) {
  const admin = createAdminClient();
  const ids: number[] = [];
  for (const descricao of causas) {
    const { data: existing } = await admin
      .from("causas")
      .select("id")
      .ilike("descricao", descricao)
      .limit(1)
      .maybeSingle();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const { data, error } = await admin
      .from("causas")
      .insert({ descricao, criado_por: userId })
      .select("id")
      .single();
    if (error || !data) throw new ApiError("Não foi possível cadastrar a causa.", 500);
    ids.push(data.id);
  }
  return ids;
}

async function collaborator(id: string | null) {
  if (!id) return null;
  const { data, error } = await createAdminClient()
    .from("usuarios")
    .select("nome, setor")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new ApiError("Colaborador informado não existe.");
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


export async function listarNcs() {
  const user = await requireUser();
  const admin = createAdminClient();
  let query = admin.from("nao_conformidades").select("*");
  if (user.papel !== "adm") {
    let teamIds: string[] = [];
    if (user.papel === "supervisor") {
      const { data: team, error: teamError } = await admin.from("usuarios").select("id").eq("supervisor_id", user.id);
      if (teamError) throw new ApiError("Não foi possível carregar a equipe.", 500);
      teamIds = (team ?? []).map((member) => member.id);
    }
    const scope = buildNcReadScopeFilter(user, teamIds);
    if (scope) query = query.or(scope);
  }
  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) throw new ApiError("Não foi possível carregar as não conformidades.", 500);
  const rows = await addCauses((data ?? []) as Array<{ id: number }>);
  return rows.map((nc) => filterSensitive(nc, user));
}

export async function buscarNc(id: number) {
  const user = await requireUser();
  const admin = createAdminClient();
  let query = admin.from("nao_conformidades").select("*").eq("id", id);
  if (user.papel !== "adm") {
    let teamIds: string[] = [];
    if (user.papel === "supervisor") {
      const { data: team, error: teamError } = await admin.from("usuarios").select("id").eq("supervisor_id", user.id);
      if (teamError) throw new ApiError("Não foi possível carregar a equipe.", 500);
      teamIds = (team ?? []).map((member) => member.id);
    }
    const scope = buildNcReadScopeFilter(user, teamIds);
    if (scope) query = query.or(scope);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new ApiError("NC não encontrada.", 404);
  const [withCauses] = await addCauses([data]);
  const filtered = filterSensitive(withCauses, user);
  return { ...filtered, duracoes: durations(filtered) };
}

export async function listarCausas() {
  await requireUser();
  const { data, error } = await createClient().then((client) =>
    client.from("causas").select("descricao").order("descricao"),
  );
  if (error) throw new ApiError("Não foi possível carregar as causas.", 500);
  return (data ?? []).map((item) => item.descricao);
}

export async function criarNc(input: NcInput) {
  const user = await requireUser();
  const data = parseInput(input);
  const [ids, employee] = await Promise.all([causeIds(data.causas, user.id), collaborator(data.colaborador_id)]);
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
  return buscarNc(Number(result.nc_id));
}

export async function editarNc(id: number, input: NcInput) {
  const user = await requireAdmin();
  const data = parseInput(input);
  const [ids, employee] = await Promise.all([causeIds(data.causas, user.id), collaborator(data.colaborador_id)]);
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("nao_conformidades")
    .update({
      data: data.data,
      chamado: data.chamado,
      setor: employee?.setor ?? null,
      colaborador: employee?.nome ?? null,
      colaborador_id: data.colaborador_id,
      criticidade: data.criticidade,
      reincidencia: "Não",
      descricao: data.descricao,
      setor_responsavel: employee?.setor ?? null,
    })
    .eq("id", id)
    .eq("status", "aberta")
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError("Não foi possível editar a NC.", 500);
  if (!updated) throw new ApiError("A NC foi alterada por outro processo. Atualize a página e tente novamente.", 409);
  await admin.from("nc_causas").delete().eq("nc_id", id);
  if (ids.length) await admin.from("nc_causas").insert(ids.map((causaId) => ({ nc_id: id, causa_id: causaId })));
  return buscarNc(id);
}

export async function excluirNc(id: number) {
  await requireAdmin();
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
  const user = await requireAdmin();
  const decisao = String(input.decisao ?? "");
  if (!['validar', 'invalidar'].includes(decisao)) throw new ApiError("decisao deve ser 'validar' ou 'invalidar'.");
  if (decisao === "invalidar") {
    const motivo = String(input.motivo_invalidacao ?? "").trim();
    if (!motivo) throw new ApiError("Informe o motivo da invalidação.");
    await rpcTransition("invalidar_nc_v3", { p_nc_id: id, p_responsavel_id: user.id, p_motivo: motivo });
    return buscarNc(id);
  }
  const result = await rpcTransition("validar_nc_com_workflow_v3", { p_nc_id: id, p_responsavel_id: user.id });
  const response = await buscarNc(id);
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
  const nc = (await buscarNc(id)) as Record<string, unknown>;
  const { data, error } = await createAdminClient()
    .from("historico_nc")
    .select("id, usuario_id, status_anterior, status_novo, observacao, criado_em")
    .eq("nc_id", id)
    .order("criado_em");
  if (error) throw new ApiError("Não foi possível carregar o histórico da NC.", 500);
  const isRestrictedAuthor =
    nc.aberto_por === user.id &&
    user.papel !== "adm" &&
    user.papel !== "supervisor" &&
    nc.colaborador_id !== user.id &&
    nc.responsavel_id !== user.id;
  const events = isRestrictedAuthor
    ? (data ?? []).map((event) => ({ ...event, observacao: null }))
    : (data ?? []);
  return { nc_id: id, status_atual: nc.status, duracoes: nc.duracoes, eventos: events };
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
  const user = await requireAdmin();
  const feedback = String(input.feedback ?? "").trim();
  if (!feedback) throw new ApiError("Informe o feedback.");
  await rpcTransition("aplicar_feedback_nc_v3", { p_nc_id: id, p_responsavel_id: user.id, p_feedback: feedback });
  return buscarNc(id);
}

export async function aceitarNc(id: number, input: { texto_aceite?: unknown }) {
  const user = await requireUser();
  const texto = String(input.texto_aceite ?? "");
  if (texto.trim().toLowerCase().replace(/\s+/g, " ") !== TEXTO_ACEITE) {
    throw new ApiError(`Para confirmar, digite exatamente: "${TEXTO_ACEITE}"`);
  }
  const current = await buscarNc(id) as Record<string, unknown>;
  if (current.colaborador_id !== user.id) {
    throw new ApiError("Somente o colaborador analisado pode registrar o aceite.", 403);
  }
  await rpcTransition("aceitar_nc_v3", { p_nc_id: id, p_colaborador_id: user.id, p_texto_aceite: texto });
  return buscarNc(id);
}
