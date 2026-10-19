import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import { ehQualidade } from "@/lib/auth/papeis";
import { buscarNc, MENSAGEM_CONFLITO, normalizeRpc } from "@/lib/nc/service";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fase 3 do processo de gestão de NCs: análise de causa (etapa própria, antes do feedback) e
 * contenção da NC crítica. Os prazos são calculados pelo banco na validação e na marcação de crítica.
 */

const ERROS: Record<string, [string, number, string?]> = {
  nc_nao_encontrada: ["NC não encontrada.", 404],
  conflito_interesse: [MENSAGEM_CONFLITO, 403],
  sem_permissao: ["Você não tem permissão para esta etapa.", 403],
  status_invalido: ["A NC já foi alterada por outro processo.", 409],
  nao_critica: ["A contenção só existe em NC crítica.", 409],
  contencao_registrada: ["A contenção desta NC já foi registrada.", 409],
  responsavel_invalido: ["Escolha um usuário ativo que não seja o colaborador analisado.", 422, "responsavel"],
};

async function rpc(name: string, params: Record<string, unknown>, campoTexto: string, mensagemTexto: string) {
  const { data, error } = await (createAdminClient() as any).rpc(name, params);
  if (error) throw new ApiError("Não foi possível registrar a etapa.", 500);
  const result = normalizeRpc(data);
  if (result.ok) return result;
  if (result.erro === "campo_obrigatorio") throw new ApiError(mensagemTexto, 422, campoTexto);
  const [mensagem, status, campo] = ERROS[String(result.erro)] ?? ["Não foi possível registrar a etapa.", 500];
  throw new ApiError(mensagem, status, campo);
}

const texto = (valor: unknown) => String(valor ?? "").trim();

export async function registrarAnaliseCausa(ncId: number, input: { analise_causa?: unknown }) {
  const user = await requireUser();
  if (!ehQualidade(user.papel)) throw new ApiError("Apenas a Qualidade registra a análise de causa.", 403);
  const analise = texto(input.analise_causa);
  const mensagem = "Descreva a causa raiz em até 4.000 caracteres.";
  if (!analise || analise.length > 4000) throw new ApiError(mensagem, 422, "analise_causa");
  await rpc("registrar_analise_causa_v1", { p_nc_id: ncId, p_usuario_id: user.id, p_texto: analise }, "analise_causa", mensagem);
  return buscarNc(ncId, user);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `acao`: "designar" (com responsavel_id) ou "registrar" (com descricao). O banco confere quem pode cada uma. */
export async function atualizarContencao(ncId: number, input: { acao?: unknown; responsavel_id?: unknown; descricao?: unknown }) {
  const user = await requireUser();
  // Leitura pelo escopo do usuário (inclui o responsável designado fora da equipe).
  await buscarNc(ncId, user);
  const acao = texto(input.acao);
  if (acao === "designar") {
    const responsavel = texto(input.responsavel_id);
    if (!UUID.test(responsavel)) throw new ApiError("Escolha o responsável pela contenção.", 422, "responsavel");
    await rpc("designar_contencao_v1", { p_nc_id: ncId, p_usuario_id: user.id, p_responsavel_id: responsavel }, "responsavel", "Escolha o responsável pela contenção.");
  } else if (acao === "registrar") {
    const descricao = texto(input.descricao);
    const mensagem = "Descreva a contenção (entre 10 e 4.000 caracteres).";
    if (descricao.length < 10 || descricao.length > 4000) throw new ApiError(mensagem, 422, "contencao_descricao");
    await rpc("registrar_contencao_v1", { p_nc_id: ncId, p_usuario_id: user.id, p_descricao: descricao }, "contencao_descricao", mensagem);
  } else {
    throw new ApiError("acao deve ser 'designar' ou 'registrar'.");
  }
  return buscarNc(ncId, user);
}
