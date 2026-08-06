import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";

import { useAuth } from "../context/AuthContext";
import { trocarSenha } from "../services/authService";
import { ErroApi } from "../services/api";

export default function TrocarSenhaPage() {
  const { marcarSenhaDefinitiva } = useAuth();
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
    if (senhaNova.length < 6) {
      setErro("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }

    setCarregando(true);
    try {
      await trocarSenha(senhaAtual, senhaNova);
      marcarSenhaDefinitiva();
      navigate("/");
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível trocar a senha.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Container className="d-flex align-items-center justify-content-center min-vh-100">
      <Row className="w-100">
        <Col xs={12} sm={8} md={5} lg={4} className="mx-auto">
          <Card className="shadow-sm">
            <Card.Body className="p-4">
              <h1 className="h4 mb-1">Defina sua senha</h1>
              <p className="text-muted mb-4">
                Esta é sua primeira vez acessando o sistema. Por segurança, defina
                uma senha só sua antes de continuar.
              </p>

              {erro && <Alert variant="danger">{erro}</Alert>}

              <Form onSubmit={aoEnviar}>
                <Form.Group className="mb-3" controlId="senhaAtual">
                  <Form.Label>Senha provisória (recebida do administrador)</Form.Label>
                  <Form.Control
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    required
                    autoFocus
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="senhaNova">
                  <Form.Label>Nova senha</Form.Label>
                  <Form.Control
                    type="password"
                    value={senhaNova}
                    onChange={(e) => setSenhaNova(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-4" controlId="confirmacao">
                  <Form.Label>Confirme a nova senha</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    required
                  />
                </Form.Group>

                <Button type="submit" variant="primary" className="w-100" disabled={carregando}>
                  {carregando ? "Salvando..." : "Definir senha e continuar"}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
