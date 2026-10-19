import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import { ehQualidade } from "@/lib/auth/papeis";
import { podeAplicarMedida, podeDecidirMedida } from "@/lib/permissions/medidas";
import { createAdminClient } from "@/lib/supabase/admin";
import { MENSAGEM_CONFLITO, normalizeRpc } from "@/lib/nc/service";

import { erroComprovante, assinaturaImagemValida } from "@/lib/nc/comprovante";

const BUCKET_COMPROVANTES = "medidas-assinadas";
const STATUS_PENDENTES = ["sugerida", "aprovada"];
const TIPOS_MEDIDA = ["advertencia", "suspensao", "avaliar_justa_causa"];

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
  if (result.erro === "justificativa_tipo") throw new ApiError("Justifique a troca do tipo sugerido (mínimo de 10 caracteres).", 422, "motivo");
  if (result.erro === "desfecho_registrado") throw new ApiError("O desfecho desta medida já foi registrado.", 409);
  if (result.erro === "desfecho_invalido") throw new ApiError("Escolha desligado ou mantido.", 422, "desfecho");
  if (result.erro === "feedback_pendente") throw new ApiError("Registre o feedback da NC antes de aprovar a medida.", 409);
  if (result.erro === "tipo_invalido") throw new ApiError("Tipo de medida inválido.", 422, "tipo");
  if (result.erro === "anexo_ausente") throw new ApiError("Anexe a foto da medida disciplinar assinada.", 422, "arquivo");
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
    .select("id, colaborador_id, causa_id, nc_id, ocorrencia_gatilho, tipo, tipo_sugerido, status, origem, dias_suspensao, data_aplicacao, observacao, decidida_por, decidida_em, motivo_decisao, aplicada_por, aplicada_em, criado_em, comprovante_nome, desfecho, desfecho_observacao, desfecho_em");
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
    permissoes: {
      decidir: podeDecidirMedida(medida, user),
      aplicar: podeAplicarMedida(medida, user),
      // N4: só a avaliação de justa causa aprovada ou aplicada registra o desfecho, uma vez, pela Qualidade sem conflito.
      registrar_desfecho: medida.tipo === "avaliar_justa_causa" && ["aprovada", "aplicada"].includes(String(medida.status))
        && !medida.desfecho && medida.colaborador_id !== user.id,
    },
  }));
}

async function carregarMedida(id: number) {
  const { data, error } = await (createAdminClient() as any).from("medidas_disciplinares")
    .select("id, colaborador_id, status, tipo, tipo_sugerido").eq("id", id).maybeSingle();
  if (error) throw new ApiError("Não foi possível carregar a medida disciplinar.", 500);
  if (!data) throw new ApiError("Medida disciplinar não encontrada.", 404);
  return data as { id: number; colaborador_id: string; status: string; tipo: string; tipo_sugerido: string | null };
}

/** Aprovar (pode trocar o tipo sugerido, com justificativa) ou reprovar (com motivo). */
export async function decidirMedida(id: number, input: { decisao?: unknown; motivo?: unknown; tipo?: unknown }) {
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
  const tipo = decisao === "aprovar" && input.tipo ? String(input.tipo) : null;
  if (tipo && !TIPOS_MEDIDA.includes(tipo)) throw new ApiError("Tipo de medida inválido.", 422, "tipo");
  if (tipo && tipo !== (medida.tipo_sugerido ?? medida.tipo) && motivo.length < 10) {
    throw new ApiError("Justifique a troca do tipo sugerido (mínimo de 10 caracteres).", 422, "motivo");
  }
  return medidaRpc("decidir_medida_v2", { p_medida_id: id, p_usuario_id: user.id, p_decisao: decisao, p_motivo: motivo || null, p_tipo: tipo });
}

/** N4: desfecho da avaliação de justa causa (desligado ou mantido), com observação. */
export async function registrarDesfechoMedida(id: number, input: { desfecho?: unknown; observacao?: unknown }) {
  const user = await requireQualidade();
  const medida = await carregarMedida(id);
  if (medida.colaborador_id === user.id) throw new ApiError(MENSAGEM_CONFLITO, 403);
  if (medida.tipo !== "avaliar_justa_causa") throw new ApiError("Só a avaliação de justa causa registra desfecho.", 422);
  const desfecho = String(input.desfecho ?? "");
  if (!["desligado", "mantido"].includes(desfecho)) throw new ApiError("Escolha desligado ou mantido.", 422, "desfecho");
  const observacao = String(input.observacao ?? "").trim();
  if (observacao.length < 10 || observacao.length > 2000) {
    throw new ApiError("Descreva o desfecho (entre 10 e 2.000 caracteres).", 422, "observacao");
  }
  return medidaRpc("registrar_desfecho_medida_v1", { p_medida_id: id, p_usuario_id: user.id, p_desfecho: desfecho, p_observacao: observacao });
}

export async function aplicarMedida(id: number, form: FormData) {
  const user = await requireQualidade();
  const medida = await carregarMedida(id);
  if (medida.colaborador_id === user.id) throw new ApiError(MENSAGEM_CONFLITO, 403);
  if (!podeAplicarMedida(medida, user)) throw new ApiError("Só é possível aplicar uma medida aprovada.", 409);
  const data = String(form.get("data") ?? "");
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(data)) || new Date(data).toISOString().slice(0, 10) !== data) {
    throw new ApiError("Informe uma data válida.", 422, "data");
  }
  if (data > hoje) throw new ApiError("A data da aplicação não pode ser futura.", 422, "data");
  const diasInformados = form.get("dias_suspensao");
  const dias = diasInformados == null || diasInformados === "" ? null : Number(diasInformados);
  if ((medida.tipo === "suspensao" && (dias === null || !Number.isInteger(dias) || dias < 1 || dias > 30)) || (medida.tipo !== "suspensao" && dias !== null)) {
    throw new ApiError("A suspensão deve ter entre 1 e 30 dias; os outros tipos não têm dias.", 422, "dias_suspensao");
  }
  const observacao = String(form.get("observacao") ?? "").trim();
  if (observacao.length > 1000) throw new ApiError("A observação deve ter no máximo 1.000 caracteres.", 422, "observacao");
  const arquivo = form.get("arquivo");
  const file = arquivo instanceof File ? arquivo : null;
  const erro = erroComprovante(file);
  if (erro || !file) throw new ApiError(erro || "Anexe a foto assinada.", 422, "arquivo");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!assinaturaImagemValida(bytes, file.type)) throw new ApiError("O conteúdo do arquivo não corresponde a uma foto válida.", 422, "arquivo");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${id}/${crypto.randomUUID()}.${extension}`;
  const nome = file.name.slice(0, 255);
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET_COMPROVANTES).upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new ApiError("Não foi possível enviar a foto. Os dados foram preservados; tente novamente.", 500, "arquivo");

  // A RPC grava o comprovante e a aplicação na mesma transação, com bloqueio da linha.
  // Em falha ambígua de rede, nunca apagamos um arquivo possivelmente já confirmado.
  const { data: resultData, error: rpcError } = await admin.rpc("aplicar_medida_com_comprovante_v2", {
    p_medida_id: id, p_usuario_id: user.id, p_data: data, p_dias_suspensao: dias,
    p_observacao: observacao || null, p_comprovante_caminho: path, p_comprovante_nome: nome,
  });
  const result = normalizeRpc(resultData);
  if (rpcError || !result.ok) {
    const { data: atual, error: consultaError } = await admin.from("medidas_disciplinares")
      .select("status, comprovante_caminho").eq("id", id).maybeSingle();
    if (!consultaError && atual?.status === "aplicada" && atual.comprovante_caminho === path) return { ok: true, medida_id: id, status: "aplicada" };
    if (!rpcError && !consultaError && atual?.comprovante_caminho !== path) {
      await admin.storage.from(BUCKET_COMPROVANTES).remove([path]);
    }
    if (!rpcError) erroDaMedida(result);
    throw new ApiError("Não foi possível confirmar o registro. Atualize a lista antes de tentar novamente.", 500);
  }
  return result;
}

/** Mesma autorização da consulta de medidas; URL curta emitida apenas ao abrir. */
export async function obterComprovanteMedida(id: number, download = false) {
  await requireQualidade();
  const admin = createAdminClient();
  const { data, error } = await admin.from("medidas_disciplinares")
    .select("comprovante_caminho, comprovante_nome").eq("id", id).maybeSingle();
  if (error) throw new ApiError("Não foi possível consultar o comprovante.", 500);
  if (!data?.comprovante_caminho) throw new ApiError("Esta medida não possui comprovante anexado.", 404);
  const { data: signed, error: signedError } = await admin.storage.from(BUCKET_COMPROVANTES)
    .createSignedUrl(data.comprovante_caminho, 60, download ? { download: data.comprovante_nome } : undefined);
  if (signedError || !signed) throw new ApiError("Não foi possível abrir o comprovante.", 500);
  return signed.signedUrl;
}
