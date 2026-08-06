import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";

export default function LoginPage() {
  const { entrar } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");
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
    <Container className="d-flex align-items-center justify-content-center min-vh-100">
      <Row className="w-100">
        <Col xs={12} sm={8} md={5} lg={4} className="mx-auto">
          <Card className="shadow-sm">
            <Card.Body className="p-4">
              <h1 className="h4 mb-1 text-center">SGNC</h1>
              <p className="text-muted text-center mb-4">
                Sistema de Gestão de Não Conformidades
              </p>

              {erro && <Alert variant="danger">{erro}</Alert>}

              <Form onSubmit={aoEnviar}>
                <Form.Group className="mb-3" controlId="email">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </Form.Group>

                <Form.Group className="mb-4" controlId="senha">
                  <Form.Label>Senha</Form.Label>
                  <Form.Control
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </Form.Group>

                <Button type="submit" variant="primary" className="w-100" disabled={carregando}>
                  {carregando ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
