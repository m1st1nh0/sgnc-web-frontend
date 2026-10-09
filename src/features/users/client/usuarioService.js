import { chamarApi } from "../../../lib/api/client/api.js";

export function listarUsuarios() {
  return chamarApi("/usuarios");
}

export function listarEquipe() {
  return chamarApi("/equipe");
}

export function listarNcsDaPessoa(usuarioId, filtros = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtros)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  return chamarApi(`/equipe/${encodeURIComponent(usuarioId)}/ncs${params.size ? `?${params}` : ""}`);
}

export function listarOpcoesNc() {
  return chamarApi("/usuarios/opcoes-nc");
}

export function cadastrarUsuario(dados) {
  return chamarApi("/usuarios", { method: "POST", body: dados });
}

export function editarUsuario(id, dados) {
  return chamarApi(`/usuarios/${id}`, { method: "PUT", body: dados });
}

export function desativarUsuario(id) {
  return chamarApi(`/usuarios/${id}/desativar`, { method: "PATCH" });
}

export function reativarUsuario(id) {
  return chamarApi(`/usuarios/${id}/reativar`, { method: "PATCH" });
}

export function buscarEstatisticasUsuario(usuarioId) {
  return chamarApi(`/usuarios/${usuarioId}/estatisticas`);
}

export function listarLiderancas() {
  return chamarApi("/equipe/liderancas");
}

export function alterarEquipe(usuarioId, dados) {
  return chamarApi(`/equipe/${encodeURIComponent(usuarioId)}`, { method: "PATCH", body: dados });
}

export function listarHistoricoEquipe(usuarioId) {
  return chamarApi(`/equipe/${encodeURIComponent(usuarioId)}/historico`);
}
