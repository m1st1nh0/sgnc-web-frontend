import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Container from "react-bootstrap/Container";

import BarraNavegacao from "../components/BarraNavegacao";
import { useAuth } from "../context/AuthContext";
import { buscarInsights } from "../services/insightsService";
import { ErroApi } from "../services/api";
import { infoDoStatus } from "../services/statusNc";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import CardMetrica from "../components/ui/CardMetrica";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import MensagemErro from "../components/ui/MensagemErro";
import PainelGrafico from "../components/ui/PainelGrafico";
import GraficoBarrasHorizontais from "../components/graficos/GraficoBarrasHorizontais";
import GraficoDonut from "../components/graficos/GraficoDonut";
import GraficoLinha from "../components/graficos/GraficoLinha";
import { CORES_GRAFICO, COR_HEX_STATUS } from "../components/graficos/cores";

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const ORDEM_STATUS = [
  "aberta",
  "validada",
  "aguardando_analise",
  "aguardando_aceite",
  "concluida",
  "invalidada",
];

const CORES_CRITICIDADE = {
  baixa: CORES_GRAFICO.verde,
  media: CORES_GRAFICO.amarelo,
  média: CORES_GRAFICO.amarelo,
  alta: CORES_GRAFICO.vermelho,
};

/** Converte "2025-08" em "ago/25". */
function formatarMes(rotulo) {
  const [ano, mes] = String(rotulo || "").split("-");
  if (!ano || !mes) return rotulo;
  return `${MESES_ABREV[Number(mes) - 1] ?? mes}/${String(ano).slice(-2)}`;
}

/** Ordena por um campo numérico e limita a quantidade de itens. */
function ordenarPorTotal(dados, chaveTotal = "total", limite = 10) {
  return [...dados]
    .filter((item) => (item[chaveTotal] ?? 0) > 0)
    .sort((a, b) => (b[chaveTotal] ?? 0) - (a[chaveTotal] ?? 0))
    .slice(0, limite);
}

export default function InsightsPage() {
  const { usuario } = useAuth();

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      setDados(await buscarInsights());
    } catch (e) {
      if (e instanceof ErroApi && e.status === 404) {
        setErro(
          "O endpoint GET /insights ainda não existe na API. Implemente-o conforme docs/insights-endpoint.md."
        );
      } else {
        setErro(
          e instanceof ErroApi
            ? e.message
            : "Não foi possível carregar os insights."
        );
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // Busca inicial dos insights ao montar a página.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, []);

  const kpis = dados?.kpis || {};
  const taxaPercentual = Math.round((kpis.taxa_invalidacao ?? 0) * 1000) / 10;

  const ncsPorMes = useMemo(
    () =>
      (dados?.ncs_por_mes || []).map((item) => ({
        ...item,
        rotuloMes: formatarMes(item.mes),
      })),
    [dados]
  );

  const funilStatus = useMemo(() => {
    const lista = dados?.ncs_por_status || [];
    const conhecidos = ORDEM_STATUS.filter((st) =>
      lista.some((item) => item.status === st)
    );
    const extras = lista
      .filter((item) => !ORDEM_STATUS.includes(item.status))
      .map((item) => item.status);
    const ordem = [...conhecidos, ...extras];
    const linhas = ordem.map((st) => {
      const item = lista.find((i) => i.status === st);
      return { ...item, rotulo: infoDoStatus(st).rotulo, [st]: item.quantidade };
    });
    const series = ordem.map((st) => ({
      chave: st,
      nome: infoDoStatus(st).rotulo,
      cor: COR_HEX_STATUS[infoDoStatus(st).cor] ?? CORES_GRAFICO.cinza,
    }));
    return { linhas, series };
  }, [dados]);

  const porColaborador = useMemo(
    () => ordenarPorTotal(dados?.ncs_por_colaborador || []),
    [dados]
  );

  const porSetor = useMemo(
    () => ordenarPorTotal(dados?.ncs_por_setor || []),
    [dados]
  );

  const porCausa = useMemo(
    () =>
      ordenarPorTotal(dados?.ncs_por_causa || []).map((c) => ({
        ...c,
        nao_reincidentes: (c.total ?? 0) - (c.total_reincidentes ?? 0),
      })),
    [dados]
  );

  const porMedida = useMemo(
    () => ordenarPorTotal(dados?.medidas_por_causa || [], "total"),
    [dados]
  );

  const porReincidencia = useMemo(
    () =>
      ordenarPorTotal(dados?.reincidencia_por_causa || [], "ocorrencias").map(
        (r) => ({
          ...r,
          nao_reincidiu: (r.ocorrencias ?? 0) - (r.reincidiu_apos_conclusao ?? 0),
        })
      ),
    [dados]
  );

  const porCriticidade = useMemo(
    () =>
      (dados?.ncs_por_criticidade || []).map((c) => ({
        nome: c.criticidade,
        valor: c.total,
        cor:
          CORES_CRITICIDADE[String(c.criticidade).toLowerCase()] ??
          CORES_GRAFICO.cinza,
      })),
    [dados]
  );

  const podeVer =
    usuario && (usuario.papel === "adm" || usuario.papel === "supervisor");
  if (!podeVer) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container">
        <CabecalhoPagina
          titulo="Insights"
          subtitulo="Visão consolidada das Não Conformidades dos últimos 12 meses"
        />

        {carregando && <EstadoCarregamento mensagem="Carregando insights..." />}

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {!carregando && !erro && dados && (
          <div className="d-flex flex-column gap-4">
            {/* KPIs */}
            <div className="row g-3">
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Total de NCs"
                  valor={kpis.total_ncs ?? 0}
                  descricao="Registradas no período"
                  cor="azul"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Abertas"
                  valor={kpis.ncs_abertas ?? 0}
                  descricao="Aguardando avaliação"
                  cor="amarela"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Pendentes"
                  valor={kpis.ncs_pendentes ?? 0}
                  descricao="Em fluxo de análise"
                  cor="laranja"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Concluídas"
                  valor={kpis.ncs_concluidas ?? 0}
                  descricao="NCs finalizadas"
                  cor="verde"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Invalidadas"
                  valor={kpis.ncs_invalidadas ?? 0}
                  descricao="Descartadas na avaliação"
                  cor="vermelha"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Taxa de invalidação"
                  valor={`${taxaPercentual.toFixed(1).replace(".", ",")}%`}
                  descricao="Invalidadas ÷ total"
                  cor="cinza"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Sem chamado"
                  valor={kpis.ncs_sem_chamado ?? 0}
                  descricao="NCs sem vínculo com chamado"
                  cor="cinza"
                />
              </div>
            </div>

            {/* Evolução mensal */}
            <PainelGrafico
              titulo="Evolução mensal"
              descricao="NCs registradas, concluídas e invalidadas por mês"
              vazio={ncsPorMes.length === 0}
            >
              <GraficoLinha
                dados={ncsPorMes}
                eixoChave="rotuloMes"
                series={[
                  { chave: "total", cor: CORES_GRAFICO.azul, nome: "Total" },
                  { chave: "concluidas", cor: CORES_GRAFICO.verde, nome: "Concluídas" },
                  { chave: "invalidadas", cor: CORES_GRAFICO.vermelho, nome: "Invalidadas" },
                ]}
                altura={280}
              />
            </PainelGrafico>

            <div className="row g-3">
              {/* __GRAFICOS_1__ */}
              <div className="col-lg-6">
                <PainelGrafico
                  titulo="NCs por colaborador"
                  descricao="Colaboradores com mais Não Conformidades"
                  vazio={porColaborador.length === 0}
                >
                  <GraficoBarrasHorizontais
                    dados={porColaborador}
                    categoriaChave="colaborador"
                    series={[
                      { chave: "total", cor: CORES_GRAFICO.azul, nome: "NCs" },
                    ]}
                  />
                </PainelGrafico>
              </div>

              <div className="col-lg-6">
                <PainelGrafico
                  titulo="NCs por setor"
                  descricao="Distribuição das NCs entre os setores"
                  vazio={porSetor.length === 0}
                >
                  <GraficoBarrasHorizontais
                    dados={porSetor}
                    categoriaChave="setor"
                    series={[
                      { chave: "total", cor: CORES_GRAFICO.ciano, nome: "NCs" },
                    ]}
                  />
                </PainelGrafico>
              </div>

              <div className="col-lg-6">
                <PainelGrafico
                  titulo="NCs por causa"
                  descricao="Causas mais recorrentes, com a parcela reincidente destacada"
                  vazio={porCausa.length === 0}
                >
                  <GraficoBarrasHorizontais
                    dados={porCausa}
                    categoriaChave="causa"
                    empilhado
                    series={[
                      { chave: "nao_reincidentes", cor: CORES_GRAFICO.azulClaro, nome: "Não reincidentes" },
                      { chave: "total_reincidentes", cor: CORES_GRAFICO.amarelo, nome: "Reincidentes" },
                    ]}
                  />
                </PainelGrafico>
              </div>

              <div className="col-lg-6">
                <PainelGrafico
                  titulo="Funil por status"
                  descricao="NCs em cada etapa do fluxo de tratamento"
                  vazio={funilStatus.linhas.length === 0}
                >
                  <GraficoBarrasHorizontais
                    dados={funilStatus.linhas}
                    categoriaChave="rotulo"
                    empilhado
                    series={funilStatus.series}
                  />
                </PainelGrafico>
              </div>
              {/* __GRAFICOS_2__ */}
              <div className="col-lg-6">
                <PainelGrafico
                  titulo="Medidas disciplinares por causa"
                  descricao="Advertências, suspensões e avaliações de justa causa"
                  vazio={porMedida.length === 0}
                >
                  <GraficoBarrasHorizontais
                    dados={porMedida}
                    categoriaChave="causa"
                    empilhado
                    series={[
                      { chave: "advertencias", cor: CORES_GRAFICO.amarelo, nome: "Advertências" },
                      { chave: "suspensoes", cor: CORES_GRAFICO.vermelho, nome: "Suspensões" },
                      { chave: "avaliacoes_justa_causa", cor: CORES_GRAFICO.violeta, nome: "Avaliar justa causa" },
                    ]}
                  />
                </PainelGrafico>
              </div>

              <div className="col-lg-6">
                <PainelGrafico
                  titulo="Reincidência por causa"
                  descricao="Ocorrências que voltaram a acontecer após uma NC concluída"
                  vazio={porReincidencia.length === 0}
                >
                  <GraficoBarrasHorizontais
                    dados={porReincidencia}
                    categoriaChave="causa"
                    empilhado
                    series={[
                      { chave: "nao_reincidiu", cor: CORES_GRAFICO.azulClaro, nome: "Demais ocorrências" },
                      { chave: "reincidiu_apos_conclusao", cor: CORES_GRAFICO.vermelho, nome: "Reincidiu após conclusão" },
                    ]}
                  />
                </PainelGrafico>
              </div>

              <div className="col-lg-6">
                <PainelGrafico
                  titulo="NCs por criticidade"
                  descricao="Severidade das NCs registradas no período"
                  vazio={porCriticidade.length === 0}
                >
                  <GraficoDonut dados={porCriticidade} />
                </PainelGrafico>
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}