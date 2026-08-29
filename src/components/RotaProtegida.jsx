import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Protege rotas autenticadas e, quando `papeis` é informado, impede que a UI
 * ofereça páginas administrativas a um papel que o backend já rejeitaria.
 * O backend continua sendo a autoridade final de autorização.
 */
export default function RotaProtegida({ children, papeis }) {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (usuario.senhaProvisoria) {
    return <Navigate to="/trocar-senha" replace />;
  }

  if (papeis?.length > 0 && !papeis.includes(usuario.papel)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
