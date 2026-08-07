import { BrowserRouter, Routes, Route } from "react-router-dom";
import EstatisticasUsuarioPage from "./pages/EstatisticasUsuarioPage";
import { AuthProvider } from "./context/AuthContext";
import RotaProtegida from "./components/RotaProtegida";
import LoginPage from "./pages/LoginPage";
import TrocarSenhaPage from "./pages/TrocarSenhaPage";
import HomePage from "./pages/HomePage";
import AbrirNcPage from "./pages/AbrirNcPage";
import EditarNcPage from "./pages/EditarNcPage";
import DetalhesNcPage from "./pages/DetalhesNcPage";
import UsuariosPage from "./pages/UsuariosPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/trocar-senha" element={<TrocarSenhaPage />} />
          <Route path="/" element={<RotaProtegida><HomePage /></RotaProtegida>} />
          <Route path="/abrir-nc" element={<RotaProtegida><AbrirNcPage /></RotaProtegida>} />
          <Route path="/nc/:id" element={<RotaProtegida><DetalhesNcPage /></RotaProtegida>} />
          <Route path="/nc/:id/editar" element={<RotaProtegida><EditarNcPage /></RotaProtegida>} />
          <Route path="/usuarios" element={<RotaProtegida><UsuariosPage /></RotaProtegida>} />
          <Route
  path="/usuarios/:usuarioId/estatisticas"
  element={
    <RotaProtegida>
      <EstatisticasUsuarioPage />
    </RotaProtegida>
  }
/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
