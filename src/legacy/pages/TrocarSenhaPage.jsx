import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Form from "react-bootstrap/Form";

import { useAuth } from "../context/AuthContext";
import { trocarSenha } from "../services/authService";
import { ErroApi } from "../services/api";
import { AJUDA_SENHA_FORTE, erroSenhaForte } from "../services/senhaPolicy";
import AuthLayout from "../components/ui/AuthLayout";
import Botao from "../components/ui/Botao";
import CampoTexto from "../components/ui/CampoTexto";
import MensagemErro from "../components/ui/MensagemErro";

export default function TrocarSenhaPage() {
  const { sair } = useAuth();
  const navigate = useNavigate();

  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");

    if (senhaNova !== confirmacao) {
      setErro("A nova senha e a confirmação não coincidem.");
      return;
    }

    const erroPolitica = erroSenhaForte(senhaNova);
    if (erroPolitica) {
      setErro(erroPolitica);
      return;
    }

    setCarregando(true);
    try {
      await trocarSenha(senhaAtual, senhaNova);
      sair();
      navigate("/login", {
        replace: true,
        state: {
          mensagem: "Senha alterada com sucesso. Faça login novamente.",
        },
      });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível trocar a senha.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="h4 mb-1">Defina sua senha</h1>
      <p className="texto-secundario mb-4">
        Esta é sua primeira vez acessando o sistema. Por segurança, defina
        uma senha só sua antes de continuar.
      </p>

      {erro && <MensagemErro mensagem={erro} />}

      <Form onSubmit={aoEnviar}>
        <CampoTexto
          rotulo="Senha provisória (recebida do administrador)"
          type="password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          required
          autoFocus
          autoComplete="current-password"
        />

        <CampoTexto
          rotulo="Nova senha"
          type="password"
          value={senhaNova}
          onChange={(e) => setSenhaNova(e.target.value)}
          required
          helper={AJUDA_SENHA_FORTE}
          autoComplete="new-password"
        />

        <CampoTexto
          rotulo="Confirme a nova senha"
          type="password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          required
          autoComplete="new-password"
        />

        <Botao
          type="submit"
          className="w-100"
          variante="primario"
          carregando={carregando}
          tamanho="lg"
        >
          Definir senha e continuar
        </Botao>
      </Form>
    </AuthLayout>
  );
}
