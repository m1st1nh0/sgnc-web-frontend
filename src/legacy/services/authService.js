import { chamarApi } from "./api";

export function login(email, senha) {
  return chamarApi("/auth/login", {
    method: "POST",
    body: { email, senha },
    semAuth: true,
  });
}

export function trocarSenha(senhaAtual, senhaNova) {
  return chamarApi("/usuarios/trocar-senha", {
    method: "POST",
    body: { senha_atual: senhaAtual, senha_nova: senhaNova },
  });
}
