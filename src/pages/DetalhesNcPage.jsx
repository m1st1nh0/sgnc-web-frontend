import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Badge from "react-bootstrap/Badge";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import BarraNavegacao from "../components/BarraNavegacao";
import PainelAvaliar from "../components/PainelAvaliar";
import PainelEnviar from "../components/PainelEnviar";
import PainelFeedback from "../components/PainelFeedback";
import PainelAceite from "../components/PainelAceite";
import { buscarNc } from "../services/ncService";
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
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function carregar() {
    try {
      setNc(await buscarNc(id));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar a NC.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [id]);

  async function excluir() {
    setExcluindo(true);
    try {
      await chamarApi(`/nc/${id}`, { method: "DELETE" });
      navigate("/");
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível excluir a NC.");
      setConfirmarExclusao(false);
    } finally {
      setExcluindo(false);
    }
  }

  const ehAdm = usuario?.papel === "adm";
  const ehAutor = nc && usuario?.id === nc.aberto_por;
  const ehColaboradorDaNc = nc && usuario?.id === nc.colaborador_id;

  const podeEditar = nc && (ehAdm || (ehAutor && nc.status === "aberta"));
  const podeExcluir = ehAdm;

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
              {podeExcluir && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setConfirmarExclusao(true)}
                >
                  Excluir
                </Button>
              )}
            </div>
          )}
        </div>

        {carregando && (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        )}

        {erro && <Alert variant="danger">{erro}</Alert>}

        {nc && (
          <div className="d-flex flex-column gap-3">
            <Card className="shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <h1 className="h5 mb-0">NC #{nc.id}</h1>
                  <Badge bg={infoDoStatus(nc.status).cor}>
                    {infoDoStatus(nc.status).rotulo}
                  </Badge>
                </div>
                <dl className="row mb-0">
                  <dt className="col-sm-4">Colaborador</dt>
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

                  {nc.motivo_invalidacao && (
                    <>
                      <dt className="col-sm-4 text-danger">Motivo da invalidação</dt>
                      <dd className="col-sm-8 text-danger">{nc.motivo_invalidacao}</dd>
                    </>
                  )}

                  {nc.feedback && (
                    <>
                      <dt className="col-sm-4">Feedback</dt>
                      <dd className="col-sm-8">{nc.feedback}</dd>
                    </>
                  )}

                  {nc.texto_aceite && (
                    <>
                      <dt className="col-sm-4">Aceite registrado</dt>
                      <dd className="col-sm-8 fst-italic">"{nc.texto_aceite}"</dd>
                    </>
                  )}
                </dl>
              </Card.Body>
            </Card>

            {ehAdm && nc.status === "aberta" && (
              <PainelAvaliar nc={nc} aoConcluir={setNc} />
            )}
            {ehAdm && nc.status === "validada" && (
              <PainelEnviar nc={nc} aoConcluir={setNc} />
            )}
            {ehAdm && nc.status === "aguardando_analise" && (
              <PainelFeedback nc={nc} aoConcluir={setNc} />
            )}
            {ehColaboradorDaNc && nc.status === "aguardando_aceite" && (
              <PainelAceite nc={nc} aoConcluir={setNc} />
            )}
          </div>
        )}
      </Container>

      <Modal show={confirmarExclusao} onHide={() => setConfirmarExclusao(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">Excluir NC #{id}?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Esta ação é permanente e não pode ser desfeita. Tem certeza?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setConfirmarExclusao(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={excluir} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Sim, excluir"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
