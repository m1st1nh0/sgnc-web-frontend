import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Badge from "react-bootstrap/Badge";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import BarraNavegacao from "../components/BarraNavegacao";
import PainelAvaliar from "../components/PainelAvaliar";
import PainelEnviar from "../components/PainelEnviar";
import PainelFeedback from "../components/PainelFeedback";
import PainelAceite from "../components/PainelAceite";
import {
  buscarNc,
  listarEvidencias,
  anexarEvidencia,
  excluirEvidencia,
} from "../services/ncService";
import { infoDoStatus } from "../services/statusNc";
import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";
import { chamarApi } from "../services/api";

export default function DetalhesNcPage() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [nc, setNc] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [confirmarExclusaoNc, setConfirmarExclusaoNc] = useState(false);
  const [excluindoNc, setExcluindoNc] = useState(false);

  // evidências
  const [evidencias, setEvidencias] = useState([]);
  const [carregandoEvidencias, setCarregandoEvidencias] = useState(false);
  const [erroEvidencias, setErroEvidencias] = useState("");
  const [arquivoNovo, setArquivoNovo] = useState(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);

  // confirmação de exclusão de evidência
  const [confirmarExclusaoEvidencia, setConfirmarExclusaoEvidencia] =
    useState(false);
  const [evidenciaSelecionada, setEvidenciaSelecionada] = useState(null);
  const [excluindoEvidencia, setExcluindoEvidencia] = useState(false);

  async function carregarNc() {
    try {
      setErro("");
      setNc(await buscarNc(id));
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : "Não foi possível carregar a NC."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function carregarEvidencias() {
    if (!id) return;
    setCarregandoEvidencias(true);
    setErroEvidencias("");
    try {
      const lista = await listarEvidencias(id);
      setEvidencias(lista);
    } catch (e) {
      setErroEvidencias(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível carregar as evidências."
      );
    } finally {
      setCarregandoEvidencias(false);
    }
  }

  useEffect(() => {
    carregarNc();
    carregarEvidencias();
  }, [id]);

  async function excluirNc() {
    setExcluindoNc(true);
    try {
      await chamarApi(`/nc/${id}`, { method: "DELETE" });
      navigate("/");
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : "Não foi possível excluir a NC."
      );
      setConfirmarExclusaoNc(false);
    } finally {
      setExcluindoNc(false);
    }
  }

  async function enviarEvidencia() {
    if (!arquivoNovo || !id) return;
    setEnviandoArquivo(true);
    setErroEvidencias("");
    try {
      await anexarEvidencia(id, arquivoNovo);
      setArquivoNovo(null);
      await carregarEvidencias();
    } catch (e) {
      setErroEvidencias(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível anexar a evidência."
      );
    } finally {
      setEnviandoArquivo(false);
    }
  }

  function abrirModalExclusaoEvidencia(evidencia) {
    setEvidenciaSelecionada(evidencia);
    setConfirmarExclusaoEvidencia(true);
  }

  async function confirmarExcluirEvidencia() {
    if (!evidenciaSelecionada || !id) return;
    setExcluindoEvidencia(true);
    setErroEvidencias("");
    try {
      await excluirEvidencia(id, evidenciaSelecionada.id);
      setConfirmarExclusaoEvidencia(false);
      setEvidenciaSelecionada(null);
      await carregarEvidencias();
    } catch (e) {
      setErroEvidencias(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível excluir a evidência."
      );
    } finally {
      setExcluindoEvidencia(false);
    }
  }

  const ehAdm = usuario?.papel === "adm";
  const ehAutor = nc && usuario?.id === nc.aberto_por;
  const ehColaboradorDaNc = nc && usuario?.id === nc.colaborador_id;
  const ehResponsavel = nc && usuario?.id === nc.responsavel_id;

  const podeVerDetalhesCompletos = ehAdm || ehColaboradorDaNc || ehResponsavel;
  const podeVerResumo = ehAutor && !podeVerDetalhesCompletos;

  const podeEditar = nc && (ehAdm || (ehAutor && nc.status === "aberta"));
  const podeExcluirNc = ehAdm;

  return (
    <div>
      <BarraNavegacao />
      <Container style={{ maxWidth: "720px" }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link to="/">&larr; Voltar para a lista</Link>
          {nc && (
            <div className="d-flex gap-2">
              {podeEditar && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => navigate(`/nc/${id}/editar`)}
                >
                  Editar
                </Button>
              )}
              {podeExcluirNc && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setConfirmarExclusaoNc(true)}
                >
                  Excluir
                </Button>
              )}
            </div>
          )}
        </div>

        {carregando && (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        )}

        {erro && <Alert variant="danger">{erro}</Alert>}

        {nc && (
          <div className="d-flex flex-column gap-3">
            {/* Card principal sempre visível */}
            <Card className="shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <h1 className="h5 mb-0">NC #{nc.id}</h1>
                  <Badge bg={infoDoStatus(nc.status).cor}>
                    {infoDoStatus(nc.status).rotulo}
                  </Badge>
                </div>
                <dl className="row mb-0">
                  <dt className="col-sm-4">Colaborador analisado</dt>
                  <dd className="col-sm-8">{nc.colaborador || "-"}</dd>

                  <dt className="col-sm-4">Setor</dt>
                  <dd className="col-sm-8">{nc.setor || "-"}</dd>

                  <dt className="col-sm-4">Chamado</dt>
                  <dd className="col-sm-8">{nc.chamado || "-"}</dd>

                  <dt className="col-sm-4">Criticidade</dt>
                  <dd className="col-sm-8">{nc.criticidade}</dd>

                  <dt className="col-sm-4">Reincidência</dt>
                  <dd className="col-sm-8">{nc.reincidencia}</dd>

                  <dt className="col-sm-4">Descrição</dt>
                  <dd className="col-sm-8">{nc.descricao}</dd>

                  <dt className="col-sm-4">Causas</dt>
                  <dd className="col-sm-8">
                    {nc.causas?.length > 0 ? nc.causas.join(", ") : "-"}
                  </dd>

                  {/* Esses campos só fazem sentido para quem vê tudo;
                      para o autor, o backend já pode estar zerando eles */}
                  {podeVerDetalhesCompletos && nc.motivo_invalidacao && (
                    <>
                      <dt className="col-sm-4 text-danger">
                        Motivo da invalidação
                      </dt>
                      <dd className="col-sm-8 text-danger">
                        {nc.motivo_invalidacao}
                      </dd>
                    </>
                  )}

                  {podeVerDetalhesCompletos && nc.feedback && (
                    <>
                      <dt className="col-sm-4">Feedback</dt>
                      <dd className="col-sm-8">{nc.feedback}</dd>
                    </>
                  )}

                  {podeVerDetalhesCompletos && nc.texto_aceite && (
                    <>
                      <dt className="col-sm-4">Aceite registrado</dt>
                      <dd className="col-sm-8 fst-italic">
                        "{nc.texto_aceite}"
                      </dd>
                    </>
                  )}
                </dl>

                {podeVerResumo && (
                  <Alert variant="info" className="mt-3 mb-0 small">
                    Você abriu esta NC para {nc.colaborador}. Os detalhes de
                    avaliação, feedback, aceite e evidências são visíveis para
                    o colaborador e o responsável. Aqui você acompanha o status
                    e os dados que registrou.
                  </Alert>
                )}
              </Card.Body>
            </Card>

            {/* Painéis de fluxo só para quem vê detalhes completos */}
            {podeVerDetalhesCompletos && ehAdm && nc.status === "aberta" && (
              <PainelAvaliar nc={nc} aoConcluir={setNc} />
            )}
            {podeVerDetalhesCompletos && ehAdm && nc.status === "validada" && (
              <PainelEnviar nc={nc} aoConcluir={setNc} />
            )}
            {podeVerDetalhesCompletos &&
              ehAdm &&
              nc.status === "aguardando_analise" && (
                <PainelFeedback nc={nc} aoConcluir={setNc} />
              )}
            {podeVerDetalhesCompletos &&
              ehColaboradorDaNc &&
              nc.status === "aguardando_aceite" && (
                <PainelAceite nc={nc} aoConcluir={setNc} />
              )}

            {/* Card de evidências – também só para quem vê detalhes completos */}
            {podeVerDetalhesCompletos && (
              <Card className="shadow-sm">
                <Card.Body className="p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2 className="h6 mb-0">Evidências</h2>
                    {nc.status === "aberta" &&
                      (ehAdm || ehAutor || ehColaboradorDaNc) && (
                        <Form className="d-flex align-items-center gap-2">
                          <Form.Control
                            type="file"
                            size="sm"
                            onChange={(e) =>
                              setArquivoNovo(e.target.files?.[0] || null)
                            }
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={!arquivoNovo || enviandoArquivo}
                            onClick={enviarEvidencia}
                          >
                            {enviandoArquivo ? "Enviando..." : "Anexar"}
                          </Button>
                        </Form>
                      )}
                  </div>

                  {erroEvidencias && (
                    <Alert variant="danger" className="mb-3">
                      {erroEvidencias}
                    </Alert>
                  )}

                  {carregandoEvidencias && (
                    <div className="text-center py-3">
                      <Spinner animation="border" size="sm" />
                    </div>
                  )}

                  {!carregandoEvidencias && evidencias.length === 0 && (
                    <p className="text-muted mb-0">
                      Nenhuma evidência anexada até o momento.
                    </p>
                  )}

                  {!carregandoEvidencias && evidencias.length > 0 && (
                    <div className="d-flex flex-column gap-2">
                      {evidencias.map((ev) => (
                        <div
                          key={ev.id}
                          className="d-flex justify-content-between align-items-center border rounded px-3 py-2"
                        >
                          <div className="me-3">
                            <div className="fw-semibold">
                              {ev.nome_original}
                            </div>
                            {ev.url_temporaria && (
                              <a
                                href={ev.url_temporaria}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="small"
                              >
                                Abrir arquivo
                              </a>
                            )}
                          </div>
                          {(ehAdm || (ehAutor && nc.status === "aberta")) && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => abrirModalExclusaoEvidencia(ev)}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}
          </div>
        )}
      </Container>

      {/* Modal de exclusão da NC */}
      <Modal
        show={confirmarExclusaoNc}
        onHide={() => setConfirmarExclusaoNc(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="h5">Excluir NC #{id}?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Esta ação é permanente e não pode ser desfeita. Tem certeza?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setConfirmarExclusaoNc(false)}
            disabled={excluindoNc}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={excluirNc}
            disabled={excluindoNc}
          >
            {excluindoNc ? "Excluindo..." : "Sim, excluir"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de exclusão de evidência */}
      <Modal
        show={confirmarExclusaoEvidencia}
        onHide={() => {
          setConfirmarExclusaoEvidencia(false);
          setEvidenciaSelecionada(null);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="h5">
            Remover evidência
            {evidenciaSelecionada
              ? ` "${evidenciaSelecionada.nome_original}"`
              : ""}
            ?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Esta ação é permanente e remove o arquivo do storage e da lista de
          evidências desta NC. Deseja continuar?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => {
              setConfirmarExclusaoEvidencia(false);
              setEvidenciaSelecionada(null);
            }}
            disabled={excluindoEvidencia}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={confirmarExcluirEvidencia}
            disabled={excluindoEvidencia}
          >
            {excluindoEvidencia ? "Removendo..." : "Sim, remover"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}