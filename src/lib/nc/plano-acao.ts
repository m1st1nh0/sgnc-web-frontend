import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import type { UsuarioAutenticado } from "@/lib/auth/types";
import { buscarNc, MENSAGEM_CONFLITO, normalizeRpc } from "@/lib/nc/service";
import { listarPessoasAbaixo } from "@/lib/permissions/team-scope";
import {
  ETAPAS_PLANO_EDITAVEIS,
  permissoesPlano,
  podeAlimentarPlano,
  podeConcluirPlano,
  podeDesmarcarCritica,
  podeMarcarCritica,
  podeVerPlano,
  type PlanoAcao,
} from "@/lib/permissions/plano-acao";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehQualidade } from "@/lib/auth/papeis";

type PlanoRegistro = {
  id: number;
  nc_id: number;
  status: string;
  responsavel_execucao_id: string | null;
  [key: string]: unknown;
};

const ERROS: Record<string, [string, number]> = {
  nc_nao_encontrada: ["NC não encontrada.", 404],
  conflito_interesse: [MENSAGEM_CONFLITO, 403],
  sem_permissao: ["Você não tem permissão para esta ação no plano de ação.", 403],
  motivo_ausente: ["Informe a justificativa (mínimo de 10 caracteres).", 422],
  ja_critica: ["Esta NC já está marcada como crítica.", 409],
  nao_critica: ["Esta NC não está marcada como crítica.", 409],
  status_invalido: ["A NC precisa estar validada para ser marcada como crítica ou ter o plano concluído.", 409],
  plano_concluido: ["O plano de ação já foi concluído e não pode mais ser alterado.", 409],
  plano_encerrado: ["O plano de ação está encerrado.", 409],
  plano_nao_encontrado: ["Plano de ação não encontrado.", 404],
  etapa_invalida: ["Etapa do plano inválida.", 422],
  planejamento_incompleto: ["Preencha causa raiz, ações, responsável e prazo antes de iniciar a execução.", 422],
  execucao_incompleta: ["Descreva a execução antes de passar para o acompanhamento.", 422],
  responsavel_invalido: ["O responsável pela execução deve ser um usuário ativo.", 422],
  texto_invalido: ["O registro deve ter entre 3 e 4.000 caracteres.", 422],
  verificador_executor: ["Quem executou o plano não pode verificar a eficácia. Outra pessoa da Qualidade deve concluir.", 403],
  plano_nao_executado: ["O plano precisa estar na etapa de acompanhamento para ser concluído.", 409],
  sem_acompanhamento: ["Registre ao menos um acompanhamento antes de concluir o plano.", 422],
  verificacao_ausente: ["Descreva a verificação de eficácia (mínimo de 10 caracteres).", 422],
};

function rpcError(result: Record<string, unknown>): never {
  const [mensagem, status] = ERROS[String(result.erro)] ?? ["Não foi possível atualizar o plano de ação.", 500];
  throw new ApiError(mensagem, status);
}

async function rpc(name: string, params: Record<string, unknown>) {
  const { data, error } = await (createAdminClient() as any).rpc(name, params);
  if (error) throw new ApiError("Não foi possível atualizar o plano de ação.", 500);
  const result = normalizeRpc(data);
  if (!result.ok) rpcError(result);
  return result;
}

async function lidera(user: UsuarioAutenticado, colaboradorId: unknown) {
  if (user.papel !== "supervisor" || !colaboradorId || colaboradorId === user.id) return false;
  return (await listarPessoasAbaixo(user.id)).some((pessoa) => pessoa.id === colaboradorId);
}

async function carregarPlano(ncId: number) {
  const { data, error } = await (createAdminClient() as any)
    .from("planos_acao").select("*").eq("nc_id", ncId).maybeSingle();
  if (error) throw new ApiError("Não foi possível carregar o plano de ação.", 500);
  return (data ?? null) as PlanoRegistro | null;
}

/** Carrega a NC já filtrada pelo escopo de leitura do usuário, o plano e a relação hierárquica. */
async function contexto(ncId: number) {
  const user = await requireUser();
  const nc = (await buscarNc(ncId)) as Record<string, unknown>;
  const [plano, lideraColaborador] = await Promise.all([carregarPlano(ncId), lidera(user, nc.colaborador_id)]);
  return { user, nc, plano, lideraColaborador };
}

async function nomes(ids: unknown[]) {
  const unicos = [...new Set(ids.filter((id): id is string => typeof id === "string" && !!id))];
  if (!unicos.length) return new Map<string, string>();
  const { data, error } = await createAdminClient().from("usuarios").select("id, nome").in("id", unicos);
  if (error) throw new ApiError("Não foi possível identificar os responsáveis do plano.", 500);
  return new Map((data ?? []).map((pessoa) => [pessoa.id, pessoa.nome]));
}

export async function obterPlanoAcao(ncId: number) {
  const { user, nc, plano, lideraColaborador } = await contexto(ncId);
  if (!podeVerPlano(nc, plano as PlanoAcao, user, lideraColaborador)) {
    throw new ApiError("Você não tem permissão para ver o plano de ação desta NC.", 403);
  }
  const permissoes = permissoesPlano(nc, plano as PlanoAcao, user, lideraColaborador);
  if (!plano) return { nc_id: ncId, critica: nc.critica === true, plano: null, acompanhamentos: [], permissoes };

  const { data: registros, error } = await (createAdminClient() as any)
    .from("plano_acao_acompanhamentos").select("id, usuario_id, tipo, texto, criado_em")
    .eq("plano_id", plano.id).order("criado_em").order("id");
  if (error) throw new ApiError("Não foi possível carregar o acompanhamento do plano.", 500);
  const acompanhamentos = (registros ?? []) as Array<Record<string, unknown>>;
  const pessoas = await nomes([
    plano.responsavel_execucao_id, plano.concluido_por, plano.cancelado_por, plano.criado_por, plano.atualizado_por,
    nc.critica_marcada_por, ...acompanhamentos.map((item) => item.usuario_id),
  ]);
  const nome = (id: unknown) => (typeof id === "string" ? pessoas.get(id) ?? "Usuário" : null);
  return {
    nc_id: ncId,
    critica: nc.critica === true,
    critica_motivo: nc.critica_motivo ?? null,
    critica_marcada_por_nome: nome(nc.critica_marcada_por),
    critica_marcada_em: nc.critica_marcada_em ?? null,
    plano: {
      ...plano,
      responsavel_execucao_nome: nome(plano.responsavel_execucao_id),
      concluido_por_nome: nome(plano.concluido_por),
      cancelado_por_nome: nome(plano.cancelado_por),
      atualizado_por_nome: nome(plano.atualizado_por),
    },
    acompanhamentos: acompanhamentos.map((item) => ({ ...item, usuario_nome: nome(item.usuario_id) })),
    permissoes,
  };
}

export async function definirCritica(ncId: number, input: { critica?: unknown; motivo?: unknown }) {
  const { user, nc, plano } = await contexto(ncId);
  if (typeof input.critica !== "boolean") throw new ApiError("Informe se a NC é crítica.", 422);
  const motivo = String(input.motivo ?? "").trim();
  if (motivo.length < 10 || motivo.length > 1000) {
    throw new ApiError("Informe a justificativa (entre 10 e 1.000 caracteres).", 422);
  }
  const permitido = input.critica ? podeMarcarCritica(nc, user) : podeDesmarcarCritica(nc, plano as PlanoAcao, user);
  if (!permitido) {
    if (nc.colaborador_id === user.id) throw new ApiError(MENSAGEM_CONFLITO, 403);
    if (!ehQualidade(user.papel)) throw new ApiError("Somente a Qualidade pode alterar a criticidade da NC.", 403);
    throw new ApiError(input.critica
      ? "A NC precisa estar validada (e não marcada) para ser marcada como crítica."
      : "Esta NC não pode ter a criticidade removida.", 409);
  }
  await rpc("definir_nc_critica_v1", { p_nc_id: ncId, p_usuario_id: user.id, p_critica: input.critica, p_motivo: motivo });
  return obterPlanoAcao(ncId);
}

function textoOpcional(valor: unknown, campo: string) {
  if (valor == null) return null;
  const texto = String(valor).trim();
  if (texto.length > 4000) throw new ApiError(`${campo} deve ter no máximo 4.000 caracteres.`, 422);
  return texto || null;
}

export async function salvarPlanoAcao(ncId: number, input: Record<string, unknown>) {
  const { user, nc, plano, lideraColaborador } = await contexto(ncId);
  if (!podeAlimentarPlano(nc, plano as PlanoAcao, user, lideraColaborador)) {
    if (nc.colaborador_id === user.id) throw new ApiError(MENSAGEM_CONFLITO, 403);
    throw new ApiError("Somente a Qualidade e a liderança do colaborador podem alimentar este plano de ação.", 403);
  }
  const status = String(input.status ?? plano?.status ?? "planejamento");
  if (!(ETAPAS_PLANO_EDITAVEIS as readonly string[]).includes(status)) throw new ApiError("Etapa do plano inválida.", 422);
  const prazo = input.prazo ? String(input.prazo) : null;
  if (prazo && (!/^\d{4}-\d{2}-\d{2}$/.test(prazo) || Number.isNaN(Date.parse(`${prazo}T00:00:00Z`)))) {
    throw new ApiError("Prazo inválido.", 422);
  }
  const responsavel = input.responsavel_execucao_id ? String(input.responsavel_execucao_id) : null;
  await rpc("salvar_plano_acao_v1", {
    p_nc_id: ncId,
    p_usuario_id: user.id,
    p_status: status,
    p_causa_raiz: textoOpcional(input.causa_raiz, "A causa raiz"),
    p_acoes: textoOpcional(input.acoes, "As ações"),
    p_responsavel_execucao_id: responsavel,
    p_prazo: prazo,
    p_execucao: textoOpcional(input.execucao, "A execução"),
  });
  return obterPlanoAcao(ncId);
}

export async function registrarAcompanhamento(ncId: number, input: { texto?: unknown }) {
  const { user, nc, plano, lideraColaborador } = await contexto(ncId);
  if (!podeAlimentarPlano(nc, plano as PlanoAcao, user, lideraColaborador)) {
    if (nc.colaborador_id === user.id) throw new ApiError(MENSAGEM_CONFLITO, 403);
    throw new ApiError("Somente a Qualidade e a liderança do colaborador podem registrar acompanhamentos.", 403);
  }
  const texto = String(input.texto ?? "").trim();
  if (texto.length < 3 || texto.length > 4000) throw new ApiError("O registro deve ter entre 3 e 4.000 caracteres.", 422);
  await rpc("registrar_acompanhamento_plano_v1", { p_nc_id: ncId, p_usuario_id: user.id, p_texto: texto });
  return obterPlanoAcao(ncId);
}

export async function concluirPlanoAcao(ncId: number, input: { verificacao_eficacia?: unknown }) {
  const { user, nc, plano } = await contexto(ncId);
  if (!podeConcluirPlano(nc, plano as PlanoAcao, user)) {
    if (nc.colaborador_id === user.id) throw new ApiError(MENSAGEM_CONFLITO, 403);
    if (!ehQualidade(user.papel)) throw new ApiError("Somente a Qualidade pode verificar a eficácia e concluir o plano.", 403);
    if (plano?.responsavel_execucao_id === user.id) rpcError({ erro: "verificador_executor" });
    throw new ApiError("O plano só pode ser concluído após o aceite da NC e com a execução registrada.", 409);
  }
  const verificacao = String(input.verificacao_eficacia ?? "").trim();
  if (verificacao.length < 10 || verificacao.length > 4000) {
    throw new ApiError("Descreva a verificação de eficácia (entre 10 e 4.000 caracteres).", 422);
  }
  await rpc("concluir_plano_acao_v1", { p_nc_id: ncId, p_usuario_id: user.id, p_verificacao: verificacao });
  return obterPlanoAcao(ncId);
}
