import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { buscarNc, editarNc, listarCausasConhecidas } from "../services/ncService";
import { listarUsuarios } from "../services/usuarioService";
import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";

const OPCOES_CRITICIDADE = ["Baixa", "Média", "Alta"];

export default function EditarNcPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [chamado, setChamado] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [criticidade, setCriticidade] = useState("Baixa");
  const [descricao, setDescricao] = useState("");
  const [causas, setCausas] = useState([]);

  const [usuarios, setUsuarios] = useState([]);
  const [causasConhecidas, setCausasConhecidas] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [acesso, setAcesso] = useState(true); // false se não puder editar

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
      try {
        const [nc, listaUsuarios, listaCausas] = await Promise.all([
          buscarNc(id),
          listarUsuarios(),
          listarCausasConhecidas(),
        ]);

        // Verifica permissão: autor enquanto aberta, ou ADM qualquer status
        const ehAutor = nc.aberto_por === usuario?.id;
        const ehAdm = usuario?.papel === "adm";
        const podeEditar = ehAdm || (ehAutor && nc.status === "aberta");

        if (!podeEditar) {
          setAcesso(false);
          setCarregandoDados(false);
          return;
        }

        setChamado(nc.chamado ?? "");
        setColaboradorId(nc.colaborador_id ?? "");
        setCriticidade(nc.criticidade ?? "Baixa");
        setDescricao(nc.descricao ?? "");
        setCausas(nc.causas ?? []);
        setUsuarios(listaUsuarios);
        setCausasConhecidas(listaCausas);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar a NC.");
      } finally {
        setCarregandoDados(false);
      }
    }
    carregar();
  }, [id, usuario]);

  const colaboradorSelecionado = usuarios.find((u) => u.id === colaboradorId);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");

    if (!colaboradorId) {
      setErro("Selecione o colaborador.");
      return;
    }
    if (!descricao.trim()) {
      setErro("Preencha a descrição.");
      return;
    }

    setEnviando(true);
    try {
      await editarNc(id, {
        chamado: chamado || null,
        colaborador_id: colaboradorId,
        criticidade,
        descricao,
        causas,
      });
      navigate(`/nc/${id}`);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar as alterações.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <BarraNavegacao />
      <Container style={{ maxWidth: "720px" }}>
        <h1 className="h4 mb-4">Editar NC #{id}</h1>

        {!acesso && (
          <Alert variant="warning">
            Você não tem permissão para editar esta NC (só é possível enquanto ela está
            em "aberta" e você for o autor, ou se for ADM).
          </Alert>
        )}

        {erro && <Alert variant="danger">{erro}</Alert>}

        {carregandoDados ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : acesso ? (
          <Card className="shadow-sm">
            <Card.Body className="p-4">
              <Form onSubmit={aoEnviar}>
                <Form.Group className="mb-3">
                  <Form.Label>Chamado</Form.Label>
                  <Form.Control
                    type="text"
                    value={chamado}
                    onChange={(e) => setChamado(e.target.value)}
                  />
                </Form.Group>

                <Row>
                  <Col md={8}>
                    <Form.Group className="mb-3">
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
                    <Form.Group className="mb-3">
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

                <Form.Group className="mb-3">
                  <Form.Label>Criticidade</Form.Label>
                  <Form.Select
                    value={criticidade}
                    onChange={(e) => setCriticidade(e.target.value)}
                  >
                    {OPCOES_CRITICIDADE.map((opcao) => (
                      <option key={opcao} value={opcao}>{opcao}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Descrição *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>Causas</Form.Label>
                  <CampoCausas
                    valor={causas}
                    aoMudar={setCausas}
                    sugestoes={causasConhecidas}
                  />
                  <Form.Text className="text-muted">
                    Digite e pressione Enter.
                  </Form.Text>
                </Form.Group>

                <div className="d-flex gap-2">
                  <Button type="submit" variant="primary" disabled={enviando}>
                    {enviando ? "Salvando..." : "Salvar alterações"}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={() => navigate(`/nc/${id}`)}
                    disabled={enviando}
                  >
                    Cancelar
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        ) : null}
      </Container>
    </div>
  );
}
