import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import EstadoCarregamento from "./components/ui/EstadoCarregamento";
import { AuthProvider } from "./context/AuthContext";
import RotaProtegida from "./components/RotaProtegida";
import LoginPage from "./pages/LoginPage";
import TrocarSenhaPage from "./pages/TrocarSenhaPage";
import HomePage from "./pages/HomePage";
import AbrirNcPage from "./pages/AbrirNcPage";
import EditarNcPage from "./pages/EditarNcPage";
import DetalhesNcPage from "./pages/DetalhesNcPage";
import UsuariosPage from "./pages/UsuariosPage";
import EstatisticasUsuarioPage from "./pages/EstatisticasUsuarioPage";

const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const RelatoriosPage = lazy(() => import("./pages/RelatoriosPage"));

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
          <Route
            path="/nc/:id/editar"
            element={
              <RotaProtegida papeis={["adm"]}>
                <EditarNcPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RotaProtegida papeis={["adm"]}>
                <UsuariosPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/insights"
            element={
              <RotaProtegida papeis={["adm", "supervisor"]}>
                <Suspense fallback={<EstadoCarregamento mensagem="Carregando insights..." />}>
                  <InsightsPage />
                </Suspense>
              </RotaProtegida>
            }
          />
          <Route
            path="/relatorios"
            element={
              <RotaProtegida papeis={["adm", "supervisor"]}>
                <Suspense fallback={<EstadoCarregamento mensagem="Carregando relatórios..." />}>
                  <RelatoriosPage />
                </Suspense>
              </RotaProtegida>
            }
          />
          <Route
            path="/usuarios/:usuarioId/dossie"
            element={
              <RotaProtegida>
                <EstatisticasUsuarioPage />
              </RotaProtegida>
            }
          />
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
