import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Protege rotas autenticadas e, quando `papeis` é informado, impede que a UI
 * ofereça páginas administrativas a um papel que o backend já rejeitaria.
 * O backend continua sendo a autoridade final de autorização.
 */
export default function RotaProtegida({ children, papeis }) {
  const { usuario } = useAuth();
  const destino = !usuario ? "/login" : usuario.senhaProvisoria ? "/trocar-senha" : null;

  useEffect(() => {
    if (destino) window.location.assign(destino);
  }, [destino]);

  if (!usuario) {
    return null;
  }

  if (usuario.senhaProvisoria) {
    return null;
  }

  if (papeis?.length > 0 && !papeis.includes(usuario.papel)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
