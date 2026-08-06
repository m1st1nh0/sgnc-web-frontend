import { createContext, useContext, useState } from "react";
import { login as loginApi } from "../services/authService";

const AuthContext = createContext(null);

/**
 * Lê o que já estava salvo no localStorage, para o usuário continuar
 * logado se der F5 na página (sem isso, perderia a sessão a cada reload).
 */
function carregarSessaoSalva() {
  const token = localStorage.getItem("sgnc_token");
  const usuarioJson = localStorage.getItem("sgnc_usuario");
  if (!token || !usuarioJson) return null;
  try {
    return { token, usuario: JSON.parse(usuarioJson) };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const sessaoSalva = carregarSessaoSalva();
  const [usuario, setUsuario] = useState(sessaoSalva?.usuario ?? null);

  async function entrar(email, senha) {
    const resposta = await loginApi(email, senha);

    const dadosUsuario = {
      id: resposta.usuario_id,
      nome: resposta.nome,
      email: resposta.email,
      papel: resposta.papel,
      senhaProvisoria: resposta.senha_provisoria,
    };

    localStorage.setItem("sgnc_token", resposta.token);
    localStorage.setItem("sgnc_usuario", JSON.stringify(dadosUsuario));
    setUsuario(dadosUsuario);

    return dadosUsuario;
  }

  function sair() {
    localStorage.removeItem("sgnc_token");
    localStorage.removeItem("sgnc_usuario");
    setUsuario(null);
  }

  /** Chamado depois que o usuário troca a senha provisória com sucesso,
   * para atualizar o estado local sem precisar logar de novo. */
  function marcarSenhaDefinitiva() {
    setUsuario((atual) => {
      if (!atual) return atual;
      const atualizado = { ...atual, senhaProvisoria: false };
      localStorage.setItem("sgnc_usuario", JSON.stringify(atualizado));
      return atualizado;
    });
  }

  return (
    <AuthContext.Provider value={{ usuario, entrar, sair, marcarSenhaDefinitiva }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook para qualquer componente acessar o usuário logado e as ações
 * de autenticação: const { usuario, entrar, sair } = useAuth(); */
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth precisa ser usado dentro de um <AuthProvider>");
  }
  return contexto;
}
