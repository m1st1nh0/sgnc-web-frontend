import { chamarApi } from "./api";

export function listarUsuarios() {
  return chamarApi("/usuarios");
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
