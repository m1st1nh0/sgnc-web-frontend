import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Badge from "react-bootstrap/Badge";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Table from "react-bootstrap/Table";

import BarraNavegacao from "../components/BarraNavegacao";
import { useAuth } from "../context/AuthContext";
import { buscarEstatisticasUsuario } from "../services/usuarioService";

const ROTULOS_MEDIDA = {
  advertencia: "Advertência",
  suspensao: "Suspensão",
  avaliar_justa_causa: "Avaliar justa causa/permanência",
};

const CORES_MEDIDA = {
  advertencia: "warning",
  suspensao: "danger",
  avaliar_justa_causa: "dark",
};

function formatarData(data) {
  if (!data) return "-";

  const partes = String(data).split("-");
  if (partes.length !== 3) return data;

  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function formatarMedida(tipo) {
  return ROTULOS_MEDIDA[tipo] || tipo || "-";
}

function corDaMedida(tipo) {
  return CORES_MEDIDA[tipo] || "secondary";
}

export default function EstatisticasUsuarioPage() {
  const { usuarioId } = useParams();
  const { usuario } = useAuth();

  const [estatisticas, setEstatisticas] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarEstatisticas() {
      if (!usuarioId) return;

      setCarregando(true);
      setErro("");

      try {
        const resposta = await buscarEstatisticasUsuario(usuarioId);
        setEstatisticas(resposta);
      } catch (e) {
        setErro(
          e?.message ||
            "Não foi possível carregar as estatísticas do colaborador."
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarEstatisticas();
  }, [usuarioId]);

  const ehPropriaEstatistica = usuario?.id === usuarioId;

  return (
    <div>
      <BarraNavegacao />

      <Container style={{ maxWidth: "1000px" }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <Link to="/" className="text-decoration-none">
              &larr; Voltar
            </Link>
            <h1 className="h4 mt-2 mb-0">
              {ehPropriaEstatistica
                ? "Minhas estatísticas"
                : "Estatísticas do colaborador"}
            </h1>
          </div>
        </div>

        {carregando && (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        )}

        {erro && <Alert variant="danger">{erro}</Alert>}

        {!carregando && !erro && estatisticas && (
          <div className="d-flex flex-column gap-3">
            <Card className="shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h2 className="h5 mb-1">{estatisticas.nome}</h2>
                    <p className="text-muted mb-0">
                      {estatisticas.setor || "Setor não informado"}
                    </p>
                  </div>

                  <Badge bg="primary">
                    Últimos 12 meses
                  </Badge>
                </div>
              </Card.Body>
            </Card>

            <div className="row g-3">
              <div className="col-md-4">
                <Card className="shadow-sm h-100">
                  <Card.Body>
                    <div className="text-muted small">
                      Não conformidades
                    </div>
                    <div className="display-6 fw-semibold">
                      {estatisticas.total_nc_12m ?? 0}
                    </div>
                    <div className="small text-muted">
                      Contabilizadas nos últimos 12 meses
                    </div>
                  </Card.Body>
                </Card>
              </div>

              <div className="col-md-4">
                <Card className="shadow-sm h-100">
                  <Card.Body>
                    <div className="text-muted small">Causas identificadas</div>
                    <div className="display-6 fw-semibold">
                      {estatisticas.causas?.length ?? 0}
                    </div>
                    <div className="small text-muted">
                      Causas com histórico registrado
                    </div>
                  </Card.Body>
                </Card>
              </div>

              <div className="col-md-4">
                <Card className="shadow-sm h-100">
                  <Card.Body>
                    <div className="text-muted small">
                      Medidas disciplinares
                    </div>
                    <div className="display-6 fw-semibold">
                      {(estatisticas.causas || []).reduce(
                        (total, causa) => total + (causa.medidas?.length || 0),
                        0
                      )}
                    </div>
                    <div className="small text-muted">
                      Medidas registradas
                    </div>
                  </Card.Body>
                </Card>
              </div>
            </div>

            {estatisticas.causas?.length === 0 ? (
              <Alert variant="light" className="border text-muted">
                Nenhuma reincidência registrada nos últimos 12 meses.
              </Alert>
            ) : (
              estatisticas.causas.map((causa) => (
                <Card
                  className="shadow-sm"
                  key={causa.causa_id}
                >
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <h2 className="h6 mb-1">
                          {causa.causa || "Causa não identificada"}
                        </h2>
                        <div className="small text-muted">
                          Causa ID: {causa.causa_id}
                        </div>
                      </div>

                      <Badge bg="secondary">
                        {causa.ocorrencias_12m} ocorrência(s)
                      </Badge>
                    </div>

                    <div className="mb-3">
                      <span className="text-muted small">
                        Última ocorrência contabilizada:{" "}
                      </span>
                      <span className="fw-semibold">
                        {causa.ultima_ocorrencia_numero || "-"}
                      </span>
                    </div>

                    {causa.medidas?.length > 0 ? (
                      <div>
                        <h3 className="h6">Medidas disciplinares</h3>

                        <Table
                          responsive
                          bordered
                          hover
                          size="sm"
                          className="mb-0"
                        >
                          <thead>
                            <tr>
                              <th>Ocorrência</th>
                              <th>Medida</th>
                              <th>Data</th>
                              <th>Status</th>
                              <th>Observação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {causa.medidas.map((medida) => (
                              <tr key={medida.id}>
                                <td>{medida.ocorrencia_gatilho}</td>
                                <td>
                                  <Badge bg={corDaMedida(medida.tipo)}>
                                    {formatarMedida(medida.tipo)}
                                  </Badge>
                                  {medida.dias_suspensao && (
                                    <div className="small text-muted mt-1">
                                      {medida.dias_suspensao} dia(s)
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {formatarData(medida.data_aplicacao)}
                                </td>
                                <td>
                                  <Badge
                                    bg={
                                      medida.status === "aplicada"
                                        ? "success"
                                        : "secondary"
                                    }
                                  >
                                    {medida.status}
                                  </Badge>
                                </td>
                                <td>{medida.observacao || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted small mb-0">
                        Nenhuma medida disciplinar registrada para esta causa.
                      </p>
                    )}
                  </Card.Body>
                </Card>
              ))
            )}
          </div>
        )}
      </Container>
    </div>
  );
}