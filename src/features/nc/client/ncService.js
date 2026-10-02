import { chamarApi } from "../../../lib/api/client/api.js";

export function listarNcs() {
  return chamarApi("/nc");
}

export function listarMinhasNcs() {
  return chamarApi("/nc/minhas");
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

export function excluirNc(id) {
  return chamarApi(`/nc/${id}`, { method: "DELETE" });
}

export function avaliarNc(id, decisao, motivoInvalidacao) {
  return chamarApi(`/nc/${id}/avaliar`, {
    method: "POST",
    body: { decisao, motivo_invalidacao: motivoInvalidacao },
  });
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

export function solicitarCausa(dados) {
  return chamarApi("/nc/causas/solicitacoes", { method: "POST", body: dados });
}

export function listarSolicitacoesCausa() {
  return chamarApi("/nc/causas/solicitacoes");
}

export function listarCausasGestao() {
  return chamarApi("/nc/causas/gestao");
}

export function criarCausaCatalogo(descricao) {
  return chamarApi("/nc/causas/gestao", { method: "POST", body: { descricao } });
}

export function atualizarCausaCatalogo(id, descricao) {
  return chamarApi(`/nc/causas/gestao/${id}`, { method: "PUT", body: { descricao } });
}

export function definirCausaAtiva(id, ativo) {
  return chamarApi(`/nc/causas/gestao/${id}`, { method: "PATCH", body: { ativo } });
}

export function excluirCausaCatalogo(id) {
  return chamarApi(`/nc/causas/gestao/${id}`, { method: "DELETE" });
}

export function decidirSolicitacaoCausa(id, dados) {
  return chamarApi("/nc/causas/solicitacoes/decidir", { method: "POST", body: { id, ...dados } });
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

export function registrarMedidaDisciplinar(dados) {
  return chamarApi("/nc/medidas-disciplinares", {
    method: "POST",
    body: dados,
  });
}
