import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import BarraNavegacao from "../components/BarraNavegacao";
import CampoCausas from "../components/CampoCausas";
import { abrirNc, listarCausasConhecidas } from "../services/ncService";
import { listarUsuarios } from "../services/usuarioService";
import { ErroApi } from "../services/api";

const OPCOES_CRITICIDADE = ["Baixa", "Média", "Alta"];

export default function AbrirNcPage() {
  const navigate = useNavigate();

  const [chamado, setChamado] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [criticidade, setCriticidade] = useState("Baixa");
  const [descricao, setDescricao] = useState("");
  const [causas, setCausas] = useState([]);

  const [usuarios, setUsuarios] = useState([]);
  const [causasConhecidas, setCausasConhecidas] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarDadosDeApoio() {
      try {
        const [listaUsuarios, listaCausas] = await Promise.all([
          listarUsuarios(),
          listarCausasConhecidas(),
        ]);
        setUsuarios(listaUsuarios);
        setCausasConhecidas(listaCausas);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar os dados do formulário.");
      } finally {
        setCarregandoDados(false);
      }
    }
    carregarDadosDeApoio();
  }, []);

  const colaboradorSelecionado = usuarios.find((u) => u.id === colaboradorId);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");

    if (!colaboradorId) {
      setErro("Selecione o colaborador sobre quem é a Não Conformidade.");
      return;
    }
    if (!descricao.trim()) {
      setErro("Descreva o que aconteceu.");
      return;
    }

    setEnviando(true);
    try {
      const nc = await abrirNc({
        chamado: chamado || null,
        colaborador_id: colaboradorId,
        criticidade,
        descricao,
        causas,
      });

      navigate(`/nc/${nc.id}`);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível abrir a Não Conformidade.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <BarraNavegacao />
      <Container style={{ maxWidth: "720px" }}>
        <h1 className="h4 mb-4">Abrir Não Conformidade</h1>

        {erro && <Alert variant="danger">{erro}</Alert>}

        {carregandoDados ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : (
          <Card className="shadow-sm">
            <Card.Body className="p-4">
              <Form onSubmit={aoEnviar}>
                <Form.Group className="mb-3" controlId="chamado">
                  <Form.Label>Chamado</Form.Label>
                  <Form.Control
                    type="text"
                    value={chamado}
                    onChange={(e) => setChamado(e.target.value)}
                    placeholder="Número ou referência do chamado"
                  />
                </Form.Group>

                <Row>
                  <Col md={8}>
                    <Form.Group className="mb-3" controlId="colaborador">
                      <Form.Label>Colaborador analisado *</Form.Label>
                      <Form.Select
                        value={colaboradorId}
                        onChange={(e) => setColaboradorId(e.target.value)}
                        required
                      >
                        <option value="">Selecione...</option>
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nome} ({u.email})
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3" controlId="setor">
                      <Form.Label>Setor</Form.Label>
                      <Form.Control
                        type="text"
                        value={colaboradorSelecionado?.setor || ""}
                        readOnly
                        disabled
                        placeholder="Definido pelo cadastro"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3" controlId="criticidade">
                  <Form.Label>Criticidade</Form.Label>
                  <Form.Select
                    value={criticidade}
                    onChange={(e) => setCriticidade(e.target.value)}
                  >
                    {OPCOES_CRITICIDADE.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {opcao}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3" controlId="descricao">
                  <Form.Label>Descrição *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-4" controlId="causas">
                  <Form.Label>Causas</Form.Label>
                  <CampoCausas
                    valor={causas}
                    aoMudar={setCausas}
                    sugestoes={causasConhecidas}
                  />
                  <Form.Text className="text-muted">
                    Digite e pressione Enter. Causas novas são adicionadas à lista
                    automaticamente.
                  </Form.Text>
                </Form.Group>

                <Button type="submit" variant="primary" disabled={enviando}>
                  {enviando ? "Salvando..." : "Abrir Não Conformidade"}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        )}
      </Container>
    </div>
  );
}
