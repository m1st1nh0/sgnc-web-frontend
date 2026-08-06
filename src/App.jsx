import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import RotaProtegida from "./components/RotaProtegida";
import LoginPage from "./pages/LoginPage";
import TrocarSenhaPage from "./pages/TrocarSenhaPage";
import HomePage from "./pages/HomePage";
import AbrirNcPage from "./pages/AbrirNcPage";
import DetalhesNcPage from "./pages/DetalhesNcPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/trocar-senha" element={<TrocarSenhaPage />} />
          <Route
            path="/"
            element={
              <RotaProtegida>
                <HomePage />
              </RotaProtegida>
            }
          />
          <Route
            path="/abrir-nc"
            element={
              <RotaProtegida>
                <AbrirNcPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/nc/:id"
            element={
              <RotaProtegida>
                <DetalhesNcPage />
              </RotaProtegida>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
