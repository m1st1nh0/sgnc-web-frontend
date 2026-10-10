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

export function obterTimeline(id) {
  return chamarApi(`/nc/${id}/timeline`);
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

/** Feedback estruturado: causa_raiz, acao_combinada, responsavel_acao_id, prazo_acao, combinado. */
export function aplicarFeedback(id, dados) {
  return chamarApi(`/nc/${id}/feedback`, {
    method: "POST",
    body: dados,
  });
}

export function obterReincidencia(id) {
  return chamarApi(`/nc/${id}/reincidencia`);
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

/** Sem `feedbackId`, é evidência da abertura; com ele, anexo do feedback recém-registrado. */
export function anexarEvidencia(ncId, arquivo, feedbackId = null) {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  if (feedbackId) formData.append("feedback_id", String(feedbackId));
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

/** `situacao`: "pendentes" (sugeridas e aprovadas a aplicar) ou "historico". */
export function listarMedidas(situacao = "pendentes") {
  return chamarApi(`/nc/medidas-disciplinares?situacao=${encodeURIComponent(situacao)}`);
}

/** Ao aprovar, `tipo` pode trocar o tipo sugerido (exige `motivo`). */
export function decidirMedida(medidaId, decisao, motivo, tipo = null) {
  return chamarApi(`/nc/medidas-disciplinares/${medidaId}/decidir`, {
    method: "POST",
    body: { decisao, motivo, tipo },
  });
}

export function aplicarMedida(medidaId, dados) {
  return chamarApi(`/nc/medidas-disciplinares/${medidaId}/aplicar`, {
    method: "POST",
    body: dados,
  });
}

export function obterPlanoAcao(ncId) {
  return chamarApi(`/nc/${ncId}/plano-acao`);
}

export function definirCritica(ncId, critica, motivo) {
  return chamarApi(`/nc/${ncId}/critica`, { method: "POST", body: { critica, motivo } });
}

export function salvarPlanoAcao(ncId, dados) {
  return chamarApi(`/nc/${ncId}/plano-acao`, { method: "PUT", body: dados });
}

export function registrarAcompanhamentoPlano(ncId, texto) {
  return chamarApi(`/nc/${ncId}/plano-acao/acompanhamentos`, { method: "POST", body: { texto } });
}

export function concluirPlanoAcao(ncId, verificacaoEficacia) {
  return chamarApi(`/nc/${ncId}/plano-acao/concluir`, {
    method: "POST",
    body: { verificacao_eficacia: verificacaoEficacia },
  });
}
