import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";

import { buscarNc } from "@/lib/nc/service";
import { podeAnexarEvidencia, podeExcluirEvidencia } from "@/lib/permissions/nc";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "evidencias";
const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "pdf", "doc", "docx", "xlsx"]);


function validateFile(file: File) {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new ApiError(`Tipo de arquivo não permitido. Aceitos: ${[...ALLOWED_EXTENSIONS].sort().map((item) => `.${item}`).join(", ")}`);
  }
  if (file.size === 0) throw new ApiError("O arquivo está vazio.", 422);
  if (file.size > MAX_SIZE) throw new ApiError("Arquivo maior que 15 MB.");
}

export async function listarEvidencias(ncId: number) {
  await requireUser();
  await buscarNc(ncId);
  const admin = createAdminClient();
  const { data, error } = await admin.from("evidencias").select("*").eq("nc_id", ncId).order("criado_em");
  if (error) throw new ApiError("Não foi possível carregar as evidências.", 500);
  return Promise.all((data ?? []).map(async (evidence) => {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(evidence.caminho_storage, 600);
    return { ...evidence, url_temporaria: signed?.signedUrl ?? null };
  }));
}

export async function anexarEvidencia(ncId: number, formData: FormData) {
  const user = await requireUser();
  const nc = await buscarNc(ncId) as Record<string, unknown>;
  if (nc.status !== "aberta") throw new ApiError("Só é possível anexar evidências enquanto a NC está em 'aberta'.");
  if (!podeAnexarEvidencia(nc, user)) {
    throw new ApiError("Somente a Qualidade, quem registrou a NC ou o colaborador analisado podem anexar evidências.", 403);
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
  const { data, error } = await admin.from("evidencias").insert({
    nc_id: ncId, caminho_storage: path, nome_original: file.name, enviado_por: user.id,
  }).select("*").single();
  if (error || !data) {
    await admin.storage.from(BUCKET).remove([path]);
    throw new ApiError("Não foi possível registrar a evidência.", 500);
  }
  return data;
}

export async function excluirEvidencia(ncId: number, evidenceId: number) {
  const user = await requireUser();
  const nc = await buscarNc(ncId) as Record<string, unknown>;
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
