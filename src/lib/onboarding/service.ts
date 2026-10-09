import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import type { UsuarioAutenticado } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

const VERSION = 1;
const SHARED: Record<string, string> = {
  apresentacao_boas_vindas: "apresentacao", apresentacao_fluxo_nc: "apresentacao",
  apresentacao_documentos: "apresentacao", checklist_conhecer_painel: "checklist",
  checklist_abrir_nc: "checklist", checklist_visualizar_nc: "checklist", checklist_dossie: "checklist",
  checklist_baixar_pdf: "checklist", dica_abertura_colaborador: "contextual",
  dica_abertura_evidencias: "contextual", dica_nc_pdf: "contextual",
};
const BY_ROLE: Record<string, Record<string, string>> = {
  adm: { apresentacao_papel_adm: "apresentacao", checklist_avaliar_nc: "checklist", checklist_feedback: "checklist", checklist_insights: "checklist", checklist_usuarios: "checklist", dica_nc_avaliacao: "contextual", dica_nc_feedback: "contextual", dica_gestao_usuarios: "contextual" },
  qualidade: { apresentacao_papel_qualidade: "apresentacao", checklist_avaliar_nc: "checklist", checklist_feedback: "checklist", checklist_insights: "checklist", checklist_equipes: "checklist", dica_nc_avaliacao: "contextual", dica_nc_feedback: "contextual" },
  supervisor: { apresentacao_papel_supervisor: "apresentacao", checklist_equipe: "checklist", checklist_acompanhar_nc: "checklist", checklist_insights: "checklist", dica_equipe_direta: "contextual", dica_dossie_equipe: "contextual" },
  funcionario: { apresentacao_papel_funcionario: "apresentacao", checklist_evidencias: "checklist", checklist_aceite: "checklist", dica_nc_aceite: "contextual", dica_dossie_pessoal: "contextual" },
};

const manifest = (role: string) => ({ ...SHARED, ...(BY_ROLE[role] ?? {}) });
const keysByOrigin = (role: string, origin: string) => Object.entries(manifest(role)).filter(([, value]) => value === origin).map(([key]) => key);
const now = () => new Date().toISOString();

async function findOrCreate(user: UsuarioAutenticado) {
  const client = await createClient();
  let query = await client.from("onboarding_execucoes").select("*").eq("usuario_id", user.id).eq("papel", user.papel).eq("versao", VERSION).limit(1).maybeSingle();
  if (query.error) throw new ApiError("Não foi possível carregar o onboarding.", 500);
  if (!query.data) {
    const created = await client.from("onboarding_execucoes").insert({ usuario_id: user.id, papel: user.papel, versao: VERSION, status: "nao_iniciado" }).select("*").single();
    if (created.error || !created.data) {
      query = await client.from("onboarding_execucoes").select("*").eq("usuario_id", user.id).eq("papel", user.papel).eq("versao", VERSION).limit(1).maybeSingle();
      if (query.error || !query.data) throw new ApiError("Não foi possível iniciar o onboarding agora.", 503);
    } else query.data = created.data;
  }
  return { client, execution: query.data! };
}

async function build(client: Awaited<ReturnType<typeof createClient>>, execution: Record<string, unknown>, user: UsuarioAutenticado, review = false) {
  const { data, error } = await client.from("onboarding_etapas").select("chave_etapa, origem, concluida_em").eq("execucao_id", execution.id).order("criado_em");
  if (error) throw new ApiError("Não foi possível carregar as etapas do onboarding.", 500);
  const stages = data ?? [];
  const completed = new Set(stages.map((item) => item.chave_etapa));
  const roleManifest = manifest(user.papel);
  const totals: Record<string, number> = {};
  const progress: Record<string, number> = {};
  for (const origin of ["apresentacao", "checklist", "contextual"]) {
    const keys = keysByOrigin(user.papel, origin);
    totals[origin] = keys.length;
    progress[origin] = keys.filter((key) => completed.has(key)).length;
  }
  totals.total = Object.keys(roleManifest).length;
  progress.total = Object.keys(roleManifest).filter((key) => completed.has(key)).length;
  return {
    execucao_id: execution.id, papel: user.papel, versao: VERSION, status: execution.status,
    iniciado_em: execution.iniciado_em ?? null, concluido_em: execution.concluido_em ?? null,
    dispensado_em: execution.dispensado_em ?? null,
    etapas_concluidas: stages.map((item) => ({ chave: item.chave_etapa, origem: item.origem, concluida_em: item.concluida_em })),
    totais: totals, progresso: progress,
    deve_exibir_apresentacao: keysByOrigin(user.papel, "apresentacao").some((key) => !completed.has(key)) && execution.status !== "dispensado",
    modo_revisao: review,
  };
}

export async function obterOnboarding(review = false) {
  const user = await requireUser();
  const { client, execution } = await findOrCreate(user);
  return build(client, execution, user, review);
}

export async function atualizarOnboarding(action: "iniciar" | "dispensar" | "concluir" | "restaurar") {
  const user = await requireUser();
  const { client, execution } = await findOrCreate(user);
  const timestamp = now();
  if (action === "concluir") {
    const { data } = await client.from("onboarding_etapas").select("chave_etapa").eq("execucao_id", execution.id);
    const completed = new Set((data ?? []).map((item) => item.chave_etapa));
    if (!keysByOrigin(user.papel, "apresentacao").every((key) => completed.has(key))) {
      throw new ApiError("Conclua a apresentação inicial antes de finalizar.", 409);
    }
  }
  if (action === "iniciar" && execution.status !== "nao_iniciado") return build(client, execution, user);
  const changes: Record<string, unknown> = { ultima_interacao_em: timestamp, atualizado_em: timestamp };
  if (action === "iniciar") Object.assign(changes, { status: "em_andamento", iniciado_em: timestamp });
  if (action === "dispensar") Object.assign(changes, { status: "dispensado", dispensado_em: timestamp });
  if (action === "concluir") Object.assign(changes, { status: "concluido", concluido_em: timestamp, dispensado_em: null });
  if (action === "restaurar") Object.assign(changes, { status: "em_andamento", dispensado_em: null });
  const { data, error } = await client.from("onboarding_execucoes").update(changes).eq("id", execution.id).select("*").single();
  if (error || !data) throw new ApiError("Não foi possível atualizar o onboarding.", 500);
  return build(client, data, user);
}

export async function concluirEtapa(key: string, input: { origem?: unknown; metadados?: unknown }) {
  const user = await requireUser();
  const expected = manifest(user.papel)[key];
  if (!expected) throw new ApiError("Etapa de onboarding não encontrada para este papel.", 404);
  if (input.origem !== expected) throw new ApiError("A origem informada não corresponde à etapa.");
  const metadata = input.metadados && typeof input.metadados === "object" ? input.metadados : {};
  if (JSON.stringify(metadata).length > 4096) throw new ApiError("Metadados da etapa excedem o limite permitido.");
  const { client, execution } = await findOrCreate(user);
  const timestamp = now();
  const { error: stageError } = await client.from("onboarding_etapas").upsert({ execucao_id: execution.id, chave_etapa: key, origem: expected, concluida_em: timestamp, metadados: metadata }, { onConflict: "execucao_id,chave_etapa" });
  if (stageError) throw new ApiError("Não foi possível concluir a etapa do onboarding.", 500);
  const { data: stages } = await client.from("onboarding_etapas").select("chave_etapa").eq("execucao_id", execution.id);
  const completed = new Set((stages ?? []).map((item) => item.chave_etapa));
  const required = [...keysByOrigin(user.papel, "apresentacao"), ...keysByOrigin(user.papel, "checklist")];
  const finished = required.every((item) => completed.has(item));
  const changes: Record<string, unknown> = { status: finished ? "concluido" : "em_andamento", ultima_interacao_em: timestamp, atualizado_em: timestamp };
  if (!execution.iniciado_em) changes.iniciado_em = timestamp;
  if (finished) Object.assign(changes, { concluido_em: timestamp, dispensado_em: null });
  const { data, error } = await client.from("onboarding_execucoes").update(changes).eq("id", execution.id).select("*").single();
  if (error || !data) throw new ApiError("Não foi possível atualizar o onboarding.", 500);
  return build(client, data, user);
}
