import { chamarApi } from "./api";

export function listarUsuarios() {
  return chamarApi("/usuarios");
}

export function cadastrarUsuario(dados) {
  return chamarApi("/usuarios", { method: "POST", body: dados });
}
