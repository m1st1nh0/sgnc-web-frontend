import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";

import BarraNavegacao from "../components/BarraNavegacao";
import { useAuth } from "../context/AuthContext";
import { buscarEstatisticasUsuario } from "../services/usuarioService";
import { registrarMedidaDisciplinar } from "../services/ncService";
import { ErroApi } from "../services/api";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import CardMetrica from "../components/ui/CardMetrica";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import EstadoVazio from "../components/ui/EstadoVazio";
import MensagemErro from "../components/ui/MensagemErro";
import Botao from "../components/ui/Botao";
import ModalRegistrarMedida from "../components/ModalRegistrarMedida";

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

function medidaDaUltimaOcorrencia(causa) {
  const numero = causa?.ultima_ocorrencia_numero;
  if (numero == null) return null;

  return (
    (causa?.medidas || []).find(
      (m) => Number(m.ocorrencia_gatilho) === Number(numero)
    ) || null
  );
}

export default function EstatisticasUsuarioPage() {
  const { usuarioId } = useParams();
  const { usuario } = useAuth();

  const [estatisticas, setEstatisticas] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

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

  useEffect(() => {
    // Busca inicial das estatísticas ao montar a página.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarEstatisticas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  const ehPropriaEstatistica = usuario?.id === usuarioId;
  const ehAdm = usuario?.papel === "adm";

  const [causaEmRegistro, setCausaEmRegistro] = useState(null);
  const [vezAberturaModal, setVezAberturaModal] = useState(0);
  const [registrandoMedida, setRegistrandoMedida] = useState(false);
  const [erroMedida, setErroMedida] = useState("");

  async function registrarMedida(dados) {
    setRegistrandoMedida(true);
    setErroMedida("");
    try {
      await registrarMedidaDisciplinar(dados);
      setCausaEmRegistro(null);
      await carregarEstatisticas();
    } catch (e) {
      setErroMedida(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível registrar a medida disciplinar."
      );
    } finally {
      setRegistrandoMedida(false);
    }
  }

  const causas = estatisticas?.causas || [];
  const totalMedidas = causas.reduce(
    (total, causa) => total + (causa.medidas?.length || 0),
    0
  );
  const causasReincidentes = causas.filter(
    (causa) => Number(causa.ocorrencias_12m) > 1
  ).length;
  const principalCausa = [...causas].sort(
    (a, b) => Number(b.ocorrencias_12m) - Number(a.ocorrencias_12m)
  )[0];

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
          subtitulo="Entenda seu histórico por causa, recorrência e medidas registradas."
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

            <div className="sg-guia-leitura">
              <strong>Como esta página é calculada</strong>
              <p>
                Cada causa é contada separadamente nas NCs procedentes dos últimos
                12 meses de calendário. NCs abertas ou invalidadas não entram.
              </p>
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
                  rotulo="Causas reincidentes"
                  valor={causasReincidentes}
                  descricao="Causas que apareceram mais de uma vez"
                  cor="amarela"
                />
              </div>
              <div className="col-md-4">
                <CardMetrica
                  rotulo={ehAdm ? "Medidas registradas" : "Causa mais frequente"}
                  valor={ehAdm ? totalMedidas : principalCausa?.ocorrencias_12m ?? 0}
                  descricao={
                    ehAdm
                      ? "Decisões manuais registradas"
                      : principalCausa?.causa || "Nenhuma causa no período"
                  }
                  cor="vermelha"
                />
              </div>
            </div>

            {/* Causas / reincidências */}
            {estatisticas.causas?.length === 0 ? (
              <EstadoVazio
                titulo="Nenhuma causa contabilizada"
                descricao="Não há NC procedente com causa registrada nesta janela de 12 meses."
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
                        <p className="texto-xs texto-suave mb-0">
                          {Number(causa.ocorrencias_12m) > 1
                            ? "Esta causa se repetiu dentro da janela analisada."
                            : "Primeira ocorrência desta causa na janela analisada."}
                        </p>
                      </div>
                      <span className={`sg-badge ${Number(causa.ocorrencias_12m) > 1 ? "sg-badge--amarelo" : "sg-badge--cinza"}`}>
                        {causa.ocorrencias_12m} {Number(causa.ocorrencias_12m) === 1 ? "ocorrência" : "ocorrências"}
                      </span>
                    </div>

                    <div className="sg-explicacao-causa mb-3">
                      <strong>Contagem canônica: {causa.ultima_ocorrencia_numero || "-"}</strong>
                      <span>
                        É o número sequencial desta causa para o colaborador, não
                        o número total de NCs.
                      </span>
                    </div>

                    {causa.medida_sugerida && (
                      <div className="sg-alerta sg-alerta--atencao p-3 mb-3 d-flex flex-wrap align-items-center gap-2">
                        <span className="texto-sm fw-semibold">
                          Sugestão para avaliação da gestão
                        </span>
                        <span
                          className={`sg-badge ${corDaMedida(causa.medida_sugerida)}`}
                        >
                          {formatarMedida(causa.medida_sugerida)}
                        </span>
                        {ehAdm &&
                          (medidaDaUltimaOcorrencia(causa) ? (
                            <span className="sg-badge sg-badge--verde">
                              Medida registrada
                            </span>
                          ) : (
                            <Botao
                              variante="secundario"
                              tamanho="sm"
                              onClick={() => {
                                setErroMedida("");
                                setVezAberturaModal((v) => v + 1);
                                setCausaEmRegistro(causa);
                              }}
                            >
                              Registrar medida
                            </Botao>
                          ))}
                      </div>
                    )}

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
                        Nenhuma medida disciplinar foi registrada manualmente para esta causa.
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Container>

      <ModalRegistrarMedida
        key={`${causaEmRegistro?.causa_id || "fechado"}-${vezAberturaModal}`}
        visivel={!!causaEmRegistro}
        causa={causaEmRegistro}
        erro={erroMedida}
        aoFechar={() => setCausaEmRegistro(null)}
        aoRegistrar={registrarMedida}
        carregando={registrandoMedida}
      />
    </div>
  );
}