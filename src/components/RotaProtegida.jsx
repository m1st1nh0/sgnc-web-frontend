import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Envolve páginas que exigem login. Se não estiver logado, manda
 * para /login. Se estiver logado mas ainda com senha provisória,
 * força a passagem pela tela de troca de senha antes de qualquer
 * outra coisa (evita alguém "pular" essa etapa navegando direto
 * para outra URL).
 */
export default function RotaProtegida({ children }) {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (usuario.senhaProvisoria) {
    return <Navigate to="/trocar-senha" replace />;
  }

  return children;
}
