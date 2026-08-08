import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";

import BarraNavegacao from "../components/BarraNavegacao";
import { useAuth } from "../context/AuthContext";
import { buscarEstatisticasUsuario } from "../services/usuarioService";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import CardMetrica from "../components/ui/CardMetrica";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import EstadoVazio from "../components/ui/EstadoVazio";
import MensagemErro from "../components/ui/MensagemErro";

const ROTULOS_MEDIDA = {
  advertencia: "Advertência",
  suspensao: "Suspensão",
  avaliar_justa_causa: "Avaliar justa causa/permanência",
};

const CORES_MEDIDA = {
  advertencia: "sg-badge--amarelo",
  suspensao: "sg-badge--vermelho",
  avaliar_justa_causa: "sg-badge--escuro",
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
  return CORES_MEDIDA[tipo] || "sg-badge--cinza";
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

  const totalMedidas = (estatisticas?.causas || []).reduce(
    (total, causa) => total + (causa.medidas?.length || 0),
    0
  );

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container" style={{ maxWidth: "1100px" }}>
        <Link to="/" className="sg-voltar mb-3 d-inline-flex">
          &larr; Voltar
        </Link>

        <CabecalhoPagina
          titulo={
            ehPropriaEstatistica
              ? "Minhas estatísticas"
              : "Estatísticas do colaborador"
          }
          subtitulo="Acompanhamento dos últimos 12 meses"
        />

        {carregando && <EstadoCarregamento mensagem="Carregando estatísticas..." />}

        {erro && <MensagemErro mensagem={erro} />}

        {!carregando && !erro && estatisticas && (
          <div className="d-flex flex-column gap-4">
            {/* Card do colaborador */}
            <div className="sg-card">
              <div className="sg-card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                  <div>
                    <h2 className="h5 mb-1">{estatisticas.nome}</h2>
                    <p className="texto-secundario mb-0">
                      {estatisticas.setor || "Setor não informado"}
                    </p>
                  </div>
                  <span className="sg-badge bg-primary sg-badge--azul">
                    Últimos 12 meses
                  </span>
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div className="row g-3">
              <div className="col-md-4">
                <CardMetrica
                  rotulo="Não conformidades"
                  valor={estatisticas.total_nc_12m ?? 0}
                  descricao="Contabilizadas nos últimos 12 meses"
                  cor="azul"
                />
              </div>
              <div className="col-md-4">
                <CardMetrica
                  rotulo="Causas identificadas"
                  valor={estatisticas.causas?.length ?? 0}
                  descricao="Causas com histórico registrado"
                  cor="amarela"
                />
              </div>
              <div className="col-md-4">
                <CardMetrica
                  rotulo="Medidas disciplinares"
                  valor={totalMedidas}
                  descricao="Medidas registradas"
                  cor="vermelha"
                />
              </div>
            </div>

            {/* Causas / reincidências */}
            {estatisticas.causas?.length === 0 ? (
              <EstadoVazio
                titulo="Nenhuma reincidência registrada"
                descricao="Nenhuma reincidência registrada nos últimos 12 meses."
              />
            ) : (
              estatisticas.causas.map((causa) => (
                <div className="sg-card" key={causa.causa_id}>
                  <div className="sg-card-body p-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                      <div>
                        <h2 className="h6 mb-1">
                          {causa.causa || "Causa não identificada"}
                        </h2>
                        <div className="texto-xs texto-suave">
                          Causa ID: {causa.causa_id}
                        </div>
                      </div>
                      <span className="sg-badge sg-badge--cinza">
                        {causa.ocorrencias_12m} ocorrência(s)
                      </span>
                    </div>

                    <div className="mb-3">
                      <span className="texto-secundario texto-sm">
                        Última ocorrência contabilizada:{" "}
                      </span>
                      <span className="fw-semibold">
                        {causa.ultima_ocorrencia_numero || "-"}
                      </span>
                    </div>

                    {causa.medidas?.length > 0 ? (
                      <div>
                        <h3 className="h6 mb-2">Medidas disciplinares</h3>
                        <div className="sg-tabela-wrap">
                          <Table responsive bordered hover size="sm" className="mb-0">
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
                                    <span className={`sg-badge ${corDaMedida(medida.tipo)}`}>
                                      {formatarMedida(medida.tipo)}
                                    </span>
                                    {medida.dias_suspensao && (
                                      <div className="texto-xs texto-suave mt-1">
                                        {medida.dias_suspensao} dia(s)
                                      </div>
                                    )}
                                  </td>
                                  <td>{formatarData(medida.data_aplicacao)}</td>
                                  <td>
                                    <span
                                      className={`sg-badge ${medida.status === "aplicada"
                                        ? "sg-badge--verde"
                                        : "sg-badge--cinza"
                                        }`}
                                    >
                                      {medida.status}
                                    </span>
                                  </td>
                                  <td>{medida.observacao || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <p className="texto-secundario texto-sm mb-0">
                        Nenhuma medida disciplinar registrada para esta causa.
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Container>
    </div>
  );
}