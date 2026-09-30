import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Form from "react-bootstrap/Form";

import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";
import AuthLayout from "../components/ui/AuthLayout";
import Botao from "../components/ui/Botao";
import CampoTexto from "../components/ui/CampoTexto";
import MensagemErro from "../components/ui/MensagemErro";

export default function LoginPage() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(location.state?.mensagem || "");

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setCarregando(true);

    try {
      const usuarioLogado = await entrar(email, senha);

      if (usuarioLogado.senhaProvisoria) {
        navigate("/trocar-senha");
      } else {
        navigate("/");
      }
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
      } else {
        setErro("Não foi possível conectar ao servidor. Verifique se a API está rodando.");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="h4 mb-1 text-center">SGNC</h1>
      <p className="texto-secundario text-center mb-4">
        Sistema de Gestão de Não Conformidades
      </p>

      {sucesso && (
        <div className="sg-alerta sg-alerta--sucesso mb-3" role="status">
          {sucesso}
        </div>
      )}

      {erro && <MensagemErro mensagem={erro} />}

      <Form onSubmit={aoEnviar}>
        <CampoTexto
          rotulo="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />

        <CampoTexto
          rotulo="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />

        <Botao
          type="submit"
          className="w-100"
          variante="primario"
          carregando={carregando}
          tamanho="lg"
        >
          Entrar
        </Botao>
      </Form>
    </AuthLayout>
  );
}