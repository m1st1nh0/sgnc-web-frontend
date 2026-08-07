import { chamarApi } from "./api";

export function listarNcs() {
  return chamarApi("/nc");
}

export function buscarNc(id) {
  return chamarApi(`/nc/${id}`);
}

export function abrirNc(dados) {
  return chamarApi("/nc", { method: "POST", body: dados });
}

export function editarNc(id, dados) {
  return chamarApi(`/nc/${id}`, { method: "PUT", body: dados });
}

export function avaliarNc(id, decisao, motivoInvalidacao) {
  return chamarApi(`/nc/${id}/avaliar`, {
    method: "POST",
    body: { decisao, motivo_invalidacao: motivoInvalidacao },
  });
}

export function enviarNc(id) {
  return chamarApi(`/nc/${id}/enviar`, { method: "POST" });
}

export function aplicarFeedback(id, feedback) {
  return chamarApi(`/nc/${id}/feedback`, {
    method: "POST",
    body: { feedback },
  });
}

export function aceitarNc(id, textoAceite) {
  return chamarApi(`/nc/${id}/aceitar`, {
    method: "POST",
    body: { texto_aceite: textoAceite },
  });
}

export function listarCausasConhecidas() {
  return chamarApi("/nc/causas");
}

export function listarEvidencias(ncId) {
  return chamarApi(`/nc/${ncId}/evidencias`);
}

export function anexarEvidencia(ncId, arquivo) {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  return chamarApi(`/nc/${ncId}/evidencias`, {
    method: "POST",
    body: formData,
  });
}
export function excluirEvidencia(ncId, evidenciaId) {
  return chamarApi(`/nc/${ncId}/evidencias/${evidenciaId}`, {
    method: "DELETE",
  });
}
