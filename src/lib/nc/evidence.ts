import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";

import { buscarNc } from "@/lib/nc/service";
import { podeAnexarAoFeedback, podeAnexarEvidencia, podeExcluirEvidencia } from "@/lib/permissions/nc";
import { createAdminClient } from "@/lib/supabase/admin";
// Mesmas regras que o formulário aplica antes de enviar (formatos e 15 MB).
import { EXTENSOES_ANEXO, MENSAGEM_FORMATO, TAMANHO_MAXIMO_ANEXO, extensaoDoArquivo } from "@/lib/nc/anexos";

const BUCKET = "evidencias";

function validateFile(file: File) {
  const extension = extensaoDoArquivo(file.name);
  if (!extension || !EXTENSOES_ANEXO.includes(extension)) throw new ApiError(MENSAGEM_FORMATO);
  if (file.size === 0) throw new ApiError("O arquivo está vazio.", 422);
  if (file.size > TAMANHO_MAXIMO_ANEXO) throw new ApiError("Arquivo maior que 15 MB.");
}

export async function listarEvidencias(ncId: number) {
  await buscarNc(ncId);
  const admin = createAdminClient();
  const { data, error } = await admin.from("evidencias").select("*").eq("nc_id", ncId).order("criado_em");
  if (error) throw new ApiError("Não foi possível carregar as evidências.", 500);
  return Promise.all((data ?? []).map(async (evidence) => {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(evidence.caminho_storage, 600);
    return { ...evidence, url_temporaria: signed?.signedUrl ?? null };
  }));
}

/**
 * Endereço temporário do arquivo de uma evidência desta NC, depois da mesma
 * checagem de acesso da NC. Usado pela rota que serve as imagens do relato.
 */
export async function urlDaEvidencia(ncId: number, evidenciaId: number) {
  await buscarNc(ncId);
  if (!Number.isInteger(ncId) || !Number.isInteger(evidenciaId)) throw new ApiError("Evidência não encontrada.", 404);
  const admin = createAdminClient();
  const { data, error } = await admin.from("evidencias").select("caminho_storage")
    .eq("id", evidenciaId).eq("nc_id", ncId).maybeSingle();
  if (error || !data) throw new ApiError("Evidência não encontrada.", 404);
  const { data: assinada } = await admin.storage.from(BUCKET).createSignedUrl(data.caminho_storage, 600);
  if (!assinada?.signedUrl) throw new ApiError("Não foi possível abrir a evidência.", 500);
  return assinada.signedUrl;
}

export async function anexarEvidencia(ncId: number, formData: FormData) {
  const user = await requireUser();
  const nc = await buscarNc(ncId, user) as Record<string, unknown>;
  const feedbackInformado = formData.get("feedback_id");
  const feedbackId = feedbackInformado == null || feedbackInformado === "" ? null : Number(feedbackInformado);
  if (feedbackId !== null) {
    // Anexo do feedback: valida que o feedback é desta NC e foi registrado por quem envia.
    if (!Number.isInteger(feedbackId)) throw new ApiError("Feedback informado é inválido.", 422);
    const { data: feedback, error: feedbackError } = await (createAdminClient() as any).from("nc_feedbacks")
      .select("id, nc_id, registrado_por").eq("id", feedbackId).maybeSingle();
    if (feedbackError) throw new ApiError("Não foi possível validar o feedback.", 500);
    if (!podeAnexarAoFeedback(nc, feedback, user)) {
      throw new ApiError("Somente quem registrou o feedback pode anexar evidências a ele, logo após o registro.", 403);
    }
  } else {
    if (nc.status !== "aberta") throw new ApiError("Só é possível anexar evidências enquanto a NC está em 'aberta'.");
    if (!podeAnexarEvidencia(nc, user)) {
      throw new ApiError("Somente a Qualidade, quem registrou a NC ou o colaborador analisado podem anexar evidências.", 403);
    }
  }
  const file = formData.get("arquivo");
  if (!(file instanceof File)) throw new ApiError("Selecione um arquivo para anexar.");
  validateFile(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `nc_${ncId}/${crypto.randomUUID().replaceAll("-", "")}_${safeName}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) throw new ApiError("Não foi possível enviar a evidência.", 500);
  // Imagem inserida no meio do relato: fica marcada para não se confundir com
  // os anexos soltos da abertura (o texto a referencia pelo id).
  const noRelato = String(formData.get("no_relato") ?? "") === "1";
  const { data, error } = await admin.from("evidencias").insert({
    nc_id: ncId, caminho_storage: path, nome_original: file.name, enviado_por: user.id, feedback_id: feedbackId,
    no_relato: noRelato,
  }).select("*").single();
  if (error || !data) {
    await admin.storage.from(BUCKET).remove([path]);
    throw new ApiError("Não foi possível registrar a evidência.", 500);
  }
  return data;
}

export async function excluirEvidencia(ncId: number, evidenceId: number) {
  const user = await requireUser();
  const nc = await buscarNc(ncId, user) as Record<string, unknown>;
  if (!podeExcluirEvidencia(nc, user)) {
    throw new ApiError("Somente a Qualidade ou quem registrou a NC, enquanto ela está em 'aberta', podem remover evidências.", 403);
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("evidencias").select("id, caminho_storage")
    .eq("id", evidenceId).eq("nc_id", ncId).maybeSingle();
  if (error || !data) throw new ApiError("Evidência não encontrada.", 404);
  const { error: storageError } = await admin.storage.from(BUCKET).remove([data.caminho_storage]);
  if (storageError) throw new ApiError("Não foi possível remover o arquivo da evidência.", 500);
  const { error: deleteError } = await admin.from("evidencias").delete().eq("id", evidenceId).eq("nc_id", ncId);
  if (deleteError) throw new ApiError("Não foi possível excluir a evidência.", 500);
  return { status: "excluida" };
}
