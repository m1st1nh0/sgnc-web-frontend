import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import { ehQualidade } from "@/lib/auth/papeis";
import { podeAplicarMedida, podeDecidirMedida } from "@/lib/permissions/medidas";
import { createAdminClient } from "@/lib/supabase/admin";
import { MENSAGEM_CONFLITO, normalizeRpc } from "@/lib/nc/service";

const STATUS_PENDENTES = ["sugerida", "aprovada"];

async function requireQualidade() {
  const user = await requireUser();
  if (!ehQualidade(user.papel)) throw new ApiError("Apenas a Qualidade pode gerenciar medidas disciplinares.", 403);
  return user;
}

function erroDaMedida(result: Record<string, unknown>): never {
  if (result.erro === "medida_nao_encontrada") throw new ApiError("Medida disciplinar não encontrada.", 404);
  if (result.erro === "conflito_interesse") throw new ApiError(MENSAGEM_CONFLITO, 403);
  if (result.erro === "sem_permissao") throw new ApiError("Apenas a Qualidade pode decidir ou aplicar medidas disciplinares.", 403);
  if (result.erro === "status_invalido") throw new ApiError("A medida já foi alterada por outra pessoa. Atualize a página.", 409);
  if (result.erro === "decisao_invalida") throw new ApiError("Decisão deve ser 'aprovar' ou 'reprovar'.", 422);
  if (result.erro === "motivo_ausente") throw new ApiError("Informe o motivo da reprovação (mínimo de 10 caracteres).", 422, "motivo");
  if (result.erro === "motivo_longo") throw new ApiError("O motivo deve ter no máximo 1.000 caracteres.", 422, "motivo");
  if (result.erro === "data_futura") throw new ApiError("A data da aplicação não pode ser futura.", 422, "data");
  if (result.erro === "dias_invalidos") throw new ApiError("A suspensão deve ter entre 1 e 30 dias; os outros tipos não têm dias.", 422, "dias_suspensao");
  if (result.erro === "observacao_longa") throw new ApiError("A observação deve ter no máximo 1.000 caracteres.", 422, "observacao");
  throw new ApiError("Não foi possível concluir a operação na medida disciplinar.", 500);
}

async function medidaRpc(nome: string, params: Record<string, unknown>) {
  const { data, error } = await createAdminClient().rpc(nome, params);
  if (error) throw new ApiError("Não foi possível concluir a operação na medida disciplinar.", 500);
  const result = normalizeRpc(data);
  if (!result.ok) erroDaMedida(result);
  return result;
}

/**
 * Medidas para a Qualidade: pendentes (sugeridas e aprovadas a aplicar) ou as últimas decididas.
 * Cada item traz as permissões do usuário, para a tela esconder as ações da própria pessoa (D19).
 */
export async function listarMedidas(situacao: string | null) {
  const user = await requireQualidade();
  const admin = createAdminClient() as any;
  let query = admin.from("medidas_disciplinares")
    .select("id, colaborador_id, causa_id, nc_id, ocorrencia_gatilho, tipo, status, dias_suspensao, data_aplicacao, observacao, decidida_por, decidida_em, motivo_decisao, aplicada_por, aplicada_em, criado_em");
  if (situacao === "historico") query = query.not("status", "in", `(${STATUS_PENDENTES.join(",")})`).order("criado_em", { ascending: false }).limit(50);
  else query = query.in("status", STATUS_PENDENTES).order("criado_em", { ascending: true });
  const { data, error } = await query;
  if (error) throw new ApiError("Não foi possível carregar as medidas disciplinares.", 500);
  const medidas = (data ?? []) as Array<Record<string, any>>;

  const pessoas = [...new Set(medidas.flatMap((item) => [item.colaborador_id, item.decidida_por, item.aplicada_por]).filter(Boolean))];
  const causas = [...new Set(medidas.map((item) => item.causa_id))];
  const [nomesResult, causasResult] = await Promise.all([
    pessoas.length ? admin.from("usuarios").select("id, nome, setor").in("id", pessoas) : { data: [], error: null },
    causas.length ? admin.from("causas").select("id, descricao").in("id", causas) : { data: [], error: null },
  ]);
  if (nomesResult.error || causasResult.error) throw new ApiError("Não foi possível carregar as medidas disciplinares.", 500);
  const nomes = new Map((nomesResult.data ?? []).map((pessoa: any) => [pessoa.id, pessoa]));
  const descricoes = new Map((causasResult.data ?? []).map((causa: any) => [causa.id, causa.descricao]));

  return medidas.map((medida) => ({
    ...medida,
    colaborador_nome: (nomes.get(medida.colaborador_id) as any)?.nome ?? null,
    colaborador_setor: (nomes.get(medida.colaborador_id) as any)?.setor ?? null,
    decidida_por_nome: (nomes.get(medida.decidida_por) as any)?.nome ?? null,
    aplicada_por_nome: (nomes.get(medida.aplicada_por) as any)?.nome ?? null,
    causa: descricoes.get(medida.causa_id) ?? `Causa ${medida.causa_id}`,
    permissoes: { decidir: podeDecidirMedida(medida, user), aplicar: podeAplicarMedida(medida, user) },
  }));
}

async function carregarMedida(id: number) {
  const { data, error } = await (createAdminClient() as any).from("medidas_disciplinares")
    .select("id, colaborador_id, status").eq("id", id).maybeSingle();
  if (error) throw new ApiError("Não foi possível carregar a medida disciplinar.", 500);
  if (!data) throw new ApiError("Medida disciplinar não encontrada.", 404);
  return data as { id: number; colaborador_id: string; status: string };
}

export async function decidirMedida(id: number, input: { decisao?: unknown; motivo?: unknown }) {
  const user = await requireQualidade();
  const medida = await carregarMedida(id);
  if (medida.colaborador_id === user.id) throw new ApiError(MENSAGEM_CONFLITO, 403);
  if (!podeDecidirMedida(medida, user)) throw new ApiError("A medida já foi alterada por outra pessoa. Atualize a página.", 409);
  const decisao = String(input.decisao ?? "");
  if (!["aprovar", "reprovar"].includes(decisao)) throw new ApiError("Decisão deve ser 'aprovar' ou 'reprovar'.", 422);
  const motivo = String(input.motivo ?? "").trim();
  if (decisao === "reprovar" && motivo.length < 10) {
    throw new ApiError("Informe o motivo da reprovação (mínimo de 10 caracteres).", 422, "motivo");
  }
  return medidaRpc("decidir_medida_v1", { p_medida_id: id, p_usuario_id: user.id, p_decisao: decisao, p_motivo: motivo || null });
}

export async function aplicarMedida(id: number, input: { data?: unknown; dias_suspensao?: unknown; observacao?: unknown }) {
  const user = await requireQualidade();
  const medida = await carregarMedida(id);
  if (medida.colaborador_id === user.id) throw new ApiError(MENSAGEM_CONFLITO, 403);
  if (!podeAplicarMedida(medida, user)) throw new ApiError("Só é possível aplicar uma medida aprovada.", 409);
  const data = input.data ? String(input.data) : null;
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ApiError("Informe uma data válida.", 422, "data");
  const dias = input.dias_suspensao == null || input.dias_suspensao === "" ? null : Number(input.dias_suspensao);
  if (dias !== null && !Number.isInteger(dias)) throw new ApiError("A suspensão deve ter entre 1 e 30 dias.", 422, "dias_suspensao");
  return medidaRpc("aplicar_medida_v1", {
    p_medida_id: id,
    p_usuario_id: user.id,
    p_data: data,
    p_dias_suspensao: dias,
    p_observacao: input.observacao == null ? null : String(input.observacao),
  });
}
