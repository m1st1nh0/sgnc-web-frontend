import { chamarApi } from "../../../lib/api/client/api.js";

export function trocarSenha(senhaAtual, senhaNova) {
  return chamarApi("/usuarios/trocar-senha", {
    method: "POST",
    body: { senha_atual: senhaAtual, senha_nova: senhaNova },
  });
}
