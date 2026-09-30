import { createContext, useContext, useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { EVENTO_SESSAO_EXPIRADA } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children, initialUser }) {
  const [usuario, setUsuario] = useState(initialUser ?? null);

  useEffect(() => {
    function encerrarSessaoExpirada() {
      setUsuario(null);
      window.location.assign("/login");
    }

    window.addEventListener(EVENTO_SESSAO_EXPIRADA, encerrarSessaoExpirada);
    return () => {
      window.removeEventListener(EVENTO_SESSAO_EXPIRADA, encerrarSessaoExpirada);
    };
  }, []);

  async function sair(senhaAlterada = false) {
    await logoutAction(senhaAlterada);
  }

  /** Chamado depois que o usuário troca a senha provisória com sucesso,
   * para atualizar o estado local sem precisar logar de novo. */
  function marcarSenhaDefinitiva() {
    setUsuario((atual) => {
      if (!atual) return atual;
      const atualizado = { ...atual, senhaProvisoria: false };
      return atualizado;
    });
  }

  return (
    <AuthContext.Provider value={{ usuario, sair, marcarSenhaDefinitiva }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook para componentes legados acessarem o usuário autenticado e sair. */
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth precisa ser usado dentro de um <AuthProvider>");
  }
  return contexto;
}
