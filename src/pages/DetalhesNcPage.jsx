import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Badge from "react-bootstrap/Badge";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";

import BarraNavegacao from "../components/BarraNavegacao";
import PainelAvaliar from "../components/PainelAvaliar";
import PainelEnviar from "../components/PainelEnviar";
import PainelFeedback from "../components/PainelFeedback";
import PainelAceite from "../components/PainelAceite";
import { buscarNc } from "../services/ncService";
import { infoDoStatus } from "../services/statusNc";
import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";

export default function DetalhesNcPage() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [nc, setNc] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try {
      setNc(await buscarNc(id));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar a NC.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function aoConcluirAcao(ncAtualizada) {
    setNc(ncAtualizada);
  }

  const ehAdm = usuario?.papel === "adm";
  const ehColaboradorDaNc = nc && usuario?.id === nc.colaborador_id;

  return (
    <div>
      <BarraNavegacao />
      <Container style={{ maxWidth: "720px" }}>
        <Link to="/" className="d-inline-block mb-3">
          &larr; Voltar para a lista
        </Link>

        {carregando && (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        )}

        {erro && <Alert variant="danger">{erro}</Alert>}

        {nc && (
          <div className="d-flex flex-column gap-3">
            <Card className="shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <h1 className="h5 mb-0">NC #{nc.id}</h1>
                  <Badge bg={infoDoStatus(nc.status).cor}>{infoDoStatus(nc.status).rotulo}</Badge>
                </div>
                <dl className="row mb-0">
                  <dt className="col-sm-4">Colaborador</dt>
                  <dd className="col-sm-8">{nc.colaborador || "-"}</dd>

                  <dt className="col-sm-4">Criticidade</dt>
                  <dd className="col-sm-8">{nc.criticidade}</dd>

                  <dt className="col-sm-4">Descrição</dt>
                  <dd className="col-sm-8">{nc.descricao}</dd>

                  <dt className="col-sm-4">Causas</dt>
                  <dd className="col-sm-8">
                    {nc.causas && nc.causas.length > 0 ? nc.causas.join(", ") : "-"}
                  </dd>

                  {nc.motivo_invalidacao && (
                    <>
                      <dt className="col-sm-4">Motivo da invalidação</dt>
                      <dd className="col-sm-8">{nc.motivo_invalidacao}</dd>
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
                      <dd className="col-sm-8">"{nc.texto_aceite}"</dd>
                    </>
                  )}
                </dl>
              </Card.Body>
            </Card>

            {/* Ações do ADM, conforme o status atual */}
            {ehAdm && nc.status === "aberta" && (
              <PainelAvaliar nc={nc} aoConcluir={aoConcluirAcao} />
            )}
            {ehAdm && nc.status === "validada" && (
              <PainelEnviar nc={nc} aoConcluir={aoConcluirAcao} />
            )}
            {ehAdm && nc.status === "aguardando_analise" && (
              <PainelFeedback nc={nc} aoConcluir={aoConcluirAcao} />
            )}

            {/* Ação do colaborador dono da NC */}
            {ehColaboradorDaNc && nc.status === "aguardando_aceite" && (
              <PainelAceite nc={nc} aoConcluir={aoConcluirAcao} />
            )}
          </div>
        )}
      </Container>
    </div>
  );
}
