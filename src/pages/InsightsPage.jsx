import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import BarraNavegacao from "../components/BarraNavegacao";
import { useAuth } from "../context/AuthContext";
import { buscarInsights } from "../services/insightsService";
import { ErroApi } from "../services/api";
import {
  descricaoTempo,
  formatarDuracao,
  ordenarInsights,
  prepararAging,
  prepararBacklogStatus,
  prepararCausas,
  prepararLinhaMensal,
  prepararReincidenciaCausa,
  rotuloEscopo,
  resumoMetodologia,
} from "../services/insightsUx";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import CardMetrica from "../components/ui/CardMetrica";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import EstadoVazio from "../components/ui/EstadoVazio";
import MensagemErro from "../components/ui/MensagemErro";
import PainelGrafico from "../components/ui/PainelGrafico";
import Botao from "../components/ui/Botao";
import GraficoBarrasHorizontais from "../components/graficos/GraficoBarrasHorizontais";
import GraficoDonut from "../components/graficos/GraficoDonut";
import GraficoLinha from "../components/graficos/GraficoLinha";
import { CORES_GRAFICO } from "../components/graficos/cores";

const CORES_CRITICIDADE = {
  baixa: CORES_GRAFICO.verde,
  media: CORES_GRAFICO.amarelo,
  média: CORES_GRAFICO.amarelo,
  alta: CORES_GRAFICO.vermelho,
};

function taxaPercentual(valor) {
  if (valor === null || valor === undefined) return "—";
  return `${(Number(valor) * 100).toFixed(1).replace(".", ",")}%`;
}

function TempoCard({ rotulo, resumo, cor }) {
  return (
    <CardMetrica
      rotulo={rotulo}
      valor={formatarDuracao(resumo?.mediana_segundos)}
      descricao={descricaoTempo(resumo)}
      cor={cor}
    />
  );
}

export default function InsightsPage() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState({ inicio: "", fim: "" });

  async function carregar(opcoes = {}) {
    setCarregando(true);
    setErro("");
    try {
      const resultado = await buscarInsights(opcoes);
      if (resultado?.versao_contrato !== "insights-v2") {
        throw new Error("Contrato de Insights incompatível com a interface V2.");
      }
      setDados(resultado);
      setFiltros({
        inicio: resultado.periodo?.inicio || opcoes.inicio || "",
        fim: resultado.periodo?.fim || opcoes.fim || "",
      });
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.message
          : e?.message || "Não foi possível carregar os insights."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, []);

  async function aplicarFiltros(evento) {
    evento.preventDefault();
    await carregar({
      inicio: filtros.inicio || undefined,
      fim: filtros.fim || undefined,
    });
  }

  async function restaurarPeriodo() {
    await carregar();
  }

  const kpis = useMemo(() => dados?.kpis || {}, [dados]);
  const tempos = useMemo(() => dados?.tempos || {}, [dados]);
  const metodologia = resumoMetodologia(dados);

  const backlogStatus = useMemo(
    () => prepararBacklogStatus(kpis),
    [kpis]
  );
  const aging = useMemo(() => prepararAging(dados?.aged_backlog), [dados]);
  const ncsPorMes = useMemo(
    () => prepararLinhaMensal(dados?.ncs_por_mes),
    [dados]
  );
  const porColaborador = useMemo(
    () => ordenarInsights(dados?.ncs_por_colaborador),
    [dados]
  );
  const porSetor = useMemo(
    () => ordenarInsights(dados?.ncs_por_setor),
    [dados]
  );
  const porCausa = useMemo(
    () => prepararCausas(dados?.ncs_por_causa),
    [dados]
  );
  const porReincidenciaCausa = useMemo(
    () => prepararReincidenciaCausa(dados?.reincidencia_por_causa),
    [dados]
  );
  const porReincidenciaColaborador = useMemo(
    () =>
      ordenarInsights(
        dados?.reincidencia_por_colaborador,
        "reincidencias_12m"
      ),
    [dados]
  );
  const porCriticidade = useMemo(
    () =>
      (dados?.ncs_por_criticidade || []).map((item) => ({
        nome: item.criticidade,
        valor: item.total,
        cor:
          CORES_CRITICIDADE[String(item.criticidade).toLowerCase()] ??
          CORES_GRAFICO.cinza,
      })),
    [dados]
  );
  const sugestoesDisciplina = useMemo(
    () =>
      ordenarInsights(
        dados?.sugestoes_disciplinares_por_causa,
        "total_sugestoes"
      ),
    [dados]
  );

  const leituraExecutiva = useMemo(() => {
    if (!dados) return [];
    const itens = [];
    const backlog = Number(kpis.backlog_ativo_atual || 0);
    const feedback = Number(kpis.aguardando_feedback_atual || 0);
    const aceite = Number(kpis.aguardando_aceite_atual || 0);

    itens.push({
      titulo: backlog === 0 ? "Operação sem pendências" : `${backlog} NC(s) exigem acompanhamento`,
      texto:
        backlog === 0
          ? "Não há NC ativa no escopo neste momento."
          : `${feedback} aguardam feedback e ${aceite} aguardam aceite.`,
    });

    if (dados.aged_backlog?.mais_antiga) {
      itens.push({
        titulo: `NC #${dados.aged_backlog.mais_antiga.nc_id} é a mais antiga`,
        texto: `Está há ${dados.aged_backlog.mais_antiga.dias_na_etapa} dia(s) na etapa atual.`,
      });
    }

    const causa = porReincidenciaCausa[0];
    itens.push({
      titulo: causa
        ? `${causa.causa} lidera as reincidências`
        : "Sem reincidência no recorte",
      texto: causa
        ? `${causa.reincidencias_12m} reincidência(s) canônica(s) em 12 meses.`
        : "Nenhuma causa reincidente foi identificada no escopo.",
    });
    return itens;
  }, [dados, kpis, porReincidenciaCausa]);

  const podeVer =
    usuario && (usuario.papel === "adm" || usuario.papel === "supervisor");
  if (!podeVer) return <Navigate to="/" replace />;

  const maisAntiga = dados?.aged_backlog?.mais_antiga;
  const disciplina = dados?.disciplina || {};
  const aplicadas = disciplina.aplicadas || {};
  const sugeridas = disciplina.sugeridas || {};

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container">
        <CabecalhoPagina
          titulo="Insights operacionais"
          subtitulo={
            dados
              ? `${rotuloEscopo(dados.escopo)} · ${metodologia.periodo}`
              : "Backlog, tempos de ciclo, reincidência e tendências"
          }
        />

        <div className="sg-card mb-4">
          <div className="sg-card-body p-3 p-md-4">
            <Form onSubmit={aplicarFiltros}>
              <div className="row g-3 align-items-end">
                <div className="col-sm-6 col-lg-3">
                  <Form.Label className="sg-label">Início do período</Form.Label>
                  <Form.Control
                    type="date"
                    className="sg-input"
                    value={filtros.inicio}
                    onChange={(e) =>
                      setFiltros((atual) => ({
                        ...atual,
                        inicio: e.target.value,
                      }))
                    }
                    disabled={carregando}
                  />
                </div>
                <div className="col-sm-6 col-lg-3">
                  <Form.Label className="sg-label">Fim do período</Form.Label>
                  <Form.Control
                    type="date"
                    className="sg-input"
                    value={filtros.fim}
                    onChange={(e) =>
                      setFiltros((atual) => ({
                        ...atual,
                        fim: e.target.value,
                      }))
                    }
                    disabled={carregando}
                  />
                </div>
                <div className="col-lg-6 d-flex flex-wrap gap-2">
                  <Botao
                    type="submit"
                    variante="primario"
                    carregando={carregando}
                  >
                    Aplicar período
                  </Botao>
                  <Botao
                    type="button"
                    variante="secundario"
                    disabled={carregando}
                    onClick={restaurarPeriodo}
                  >
                    Últimos 12 meses
                  </Botao>
                </div>
              </div>
            </Form>

            {dados && (
              <div className="sg-periodo-explicado mt-3">
                <div>
                  <strong>Fotografia atual</strong>
                  <span>Backlog e aging não mudam com o filtro de datas.</span>
                </div>
                <div>
                  <strong>Histórico do período</strong>
                  <span>Volume, tendências e tempos respeitam o intervalo selecionado.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {carregando && !dados && (
          <EstadoCarregamento mensagem="Carregando insights..." />
        )}
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {!erro && dados && (
          <>
            <nav className="sg-indice-insights mb-4" aria-label="Atalhos dos Insights">
              <a href="#operacao">Operação agora</a>
              <a href="#tempos">Tempos</a>
              <a href="#reincidencia">Reincidência</a>
              <a href="#distribuicao">Distribuição</a>
              <a href="#disciplina">Disciplina</a>
            </nav>

            <section className="sg-leitura-executiva mb-5" aria-labelledby="leitura-executiva">
              <div>
                <span className="sg-leitura-executiva__rotulo">Leitura rápida</span>
                <h2 id="leitura-executiva">O que estes números dizem agora</h2>
                <p>Resumo automático para orientar a análise; a decisão continua com a gestão.</p>
              </div>
              <div className="sg-leitura-executiva__itens">
                {leituraExecutiva.map((item) => (
                  <article key={item.titulo}>
                    <strong>{item.titulo}</strong>
                    <span>{item.texto}</span>
                  </article>
                ))}
              </div>
            </section>

          <div className="sg-insights d-flex flex-column gap-5">
            <section id="operacao" className="sg-insights__secao sg-insights__secao--norma">
              <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
                <div>
                  <h2 className="h5 mb-1">Operação agora</h2>
                  <p className="texto-sm texto-suave mb-0">
                    Estoque atual de NCs que ainda exigem alguma ação.
                  </p>
                </div>
                {maisAntiga && (
                  <div className="texto-sm">
                    <span className="texto-suave">Mais antiga no backlog:</span>{" "}
                    <strong>
                      NC #{maisAntiga.nc_id} · {maisAntiga.dias_na_etapa}d
                    </strong>
                  </div>
                )}
              </div>

              <div className="row g-3 mb-3">
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Backlog ativo"
                    valor={kpis.backlog_ativo_atual ?? 0}
                    descricao="Todas as NCs ativas agora"
                    cor="azul"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Aguardando avaliação"
                    valor={kpis.abertas_atuais ?? 0}
                    descricao="Ainda sem decisão administrativa"
                    cor="amarela"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Aguardando feedback"
                    valor={kpis.aguardando_feedback_atual ?? 0}
                    descricao="Procedentes aguardando tratamento"
                    cor="laranja"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Aguardando aceite"
                    valor={kpis.aguardando_aceite_atual ?? 0}
                    descricao="Feedback aplicado, confirmação pendente"
                    cor="verde"
                  />
                </div>
              </div>

              <div className="row g-3">
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Backlog por etapa"
                    descricao="Onde as NCs ativas estão paradas neste momento"
                    vazio={(kpis.backlog_ativo_atual ?? 0) === 0}
                  >
                    <GraficoBarrasHorizontais
                      dados={backlogStatus}
                      categoriaChave="status"
                      series={[
                        {
                          chave: "quantidade",
                          cor: CORES_GRAFICO.azul,
                          nome: "NCs",
                        },
                      ]}
                      altura={230}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Aging do backlog"
                    descricao="Tempo já acumulado na etapa atual"
                    vazio={(dados.aged_backlog?.total ?? 0) === 0}
                  >
                    <GraficoBarrasHorizontais
                      dados={aging}
                      categoriaChave="faixa"
                      series={[
                        {
                          chave: "quantidade",
                          cor: CORES_GRAFICO.laranja,
                          nome: "NCs",
                        },
                      ]}
                      altura={230}
                    />
                  </PainelGrafico>
                </div>
              </div>
            </section>

            <section id="tempos" className="sg-insights__secao">
              <div className="mb-3">
                <h2 className="h5 mb-1">Velocidade do fluxo</h2>
                <p className="texto-sm texto-suave mb-0">
                  O valor principal é a mediana; a média e o tamanho da amostra
                  aparecem abaixo para evitar conclusões distorcidas por outliers.
                </p>
              </div>
              <div className="row g-3">
                <div className="col-sm-6 col-xl-3">
                  <TempoCard
                    rotulo="Até validação"
                    resumo={tempos.criacao_ate_validacao}
                    cor="azul"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <TempoCard
                    rotulo="Validação → feedback"
                    resumo={tempos.validacao_ate_feedback}
                    cor="laranja"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <TempoCard
                    rotulo="Feedback → aceite"
                    resumo={tempos.feedback_ate_aceite}
                    cor="amarela"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <TempoCard
                    rotulo="Ciclo total"
                    resumo={tempos.ciclo_total}
                    cor="verde"
                  />
                </div>
              </div>
            </section>

            <section className="sg-insights__secao sg-insights__secao--norma">
              <div className="mb-3">
                <h2 className="h5 mb-1">Movimento no período</h2>
                <p className="texto-sm texto-suave mb-0">
                  Volume histórico dentro do intervalo selecionado.
                </p>
              </div>
              <div className="row g-3 mb-3">
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="NCs registradas"
                    valor={kpis.total_ncs ?? 0}
                    descricao="Abertas no período"
                    cor="azul"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Concluídas no período"
                    valor={kpis.concluidas_no_periodo ?? 0}
                    descricao="Aceites registrados no intervalo"
                    cor="verde"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Invalidadas no período"
                    valor={kpis.invalidadas_no_periodo ?? 0}
                    descricao="Decisões de invalidação no intervalo"
                    cor="vermelha"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Taxa de invalidação"
                    valor={taxaPercentual(kpis.taxa_invalidacao)}
                    descricao="Invalidadas entre NCs do período"
                    cor="cinza"
                  />
                </div>
              </div>

              <PainelGrafico
                titulo="Evolução mensal"
                descricao="Registros, conclusões, invalidações e reincidências por mês de abertura"
                vazio={ncsPorMes.length === 0}
              >
                <GraficoLinha
                  dados={ncsPorMes}
                  eixoChave="rotuloMes"
                  series={[
                    {
                      chave: "total",
                      cor: CORES_GRAFICO.azul,
                      nome: "Registradas",
                    },
                    {
                      chave: "concluidas",
                      cor: CORES_GRAFICO.verde,
                      nome: "Concluídas",
                    },
                    {
                      chave: "invalidadas",
                      cor: CORES_GRAFICO.vermelho,
                      nome: "Invalidadas",
                    },
                    {
                      chave: "reincidentes",
                      cor: CORES_GRAFICO.laranja,
                      nome: "Reincidentes",
                    },
                  ]}
                  altura={300}
                />
              </PainelGrafico>
            </section>

            <section id="reincidencia" className="sg-insights__secao sg-insights__secao--pendencia">
              <div className="mb-3">
                <h2 className="h5 mb-1">Causas e reincidência</h2>
                <p className="texto-sm texto-suave mb-0">
                  A primeira ocorrência inicia a contagem; as seguintes, para o mesmo colaborador e a mesma causa, são reincidências dentro de 12 meses. Apenas NCs procedentes entram.
                </p>
              </div>
              <div className="row g-3">
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Principais causas"
                    descricao="Volume total com a parcela reincidente destacada"
                    vazio={porCausa.length === 0}
                  >
                    <GraficoBarrasHorizontais
                      dados={porCausa}
                      categoriaChave="causa"
                      empilhado
                      series={[
                        {
                          chave: "nao_reincidentes",
                          cor: CORES_GRAFICO.azulClaro,
                          nome: "Demais ocorrências",
                        },
                        {
                          chave: "total_reincidentes",
                          cor: CORES_GRAFICO.laranja,
                          nome: "Reincidentes",
                        },
                      ]}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Reincidência por causa"
                    descricao="Ocorrências procedentes na janela móvel de 12 meses"
                    vazio={porReincidenciaCausa.length === 0}
                  >
                    <GraficoBarrasHorizontais
                      dados={porReincidenciaCausa}
                      categoriaChave="causa"
                      empilhado
                      series={[
                        {
                          chave: "demais_ocorrencias",
                          cor: CORES_GRAFICO.azulClaro,
                          nome: "Primeiras ocorrências",
                        },
                        {
                          chave: "reincidencias_12m",
                          cor: CORES_GRAFICO.vermelho,
                          nome: "Reincidências 12m",
                        },
                      ]}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Reincidência por colaborador"
                    descricao="Colaboradores com ocorrências reincidentes no período"
                    vazio={porReincidenciaColaborador.length === 0}
                  >
                    <GraficoBarrasHorizontais
                      dados={porReincidenciaColaborador}
                      categoriaChave="colaborador"
                      series={[
                        {
                          chave: "reincidencias_12m",
                          cor: CORES_GRAFICO.vermelho,
                          nome: "Reincidências 12m",
                        },
                      ]}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="NCs por criticidade"
                    descricao="Severidade das NCs abertas no período"
                    vazio={porCriticidade.length === 0}
                  >
                    <GraficoDonut dados={porCriticidade} />
                  </PainelGrafico>
                </div>
              </div>
            </section>

            <section id="distribuicao" className="sg-insights__secao">
              <div className="mb-3">
                <h2 className="h5 mb-1">Distribuição organizacional</h2>
                <p className="texto-sm texto-suave mb-0">
                  Para supervisores, estes gráficos permanecem limitados à
                  equipe direta pelo backend.
                </p>
              </div>
              <div className="row g-3">
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="NCs por colaborador"
                    descricao="Volume e backlog dos colaboradores no escopo"
                    vazio={porColaborador.length === 0}
                  >
                    <GraficoBarrasHorizontais
                      dados={porColaborador}
                      categoriaChave="colaborador"
                      series={[
                        {
                          chave: "total",
                          cor: CORES_GRAFICO.azul,
                          nome: "NCs no período",
                        },
                      ]}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="NCs por setor"
                    descricao="Distribuição de registros entre os setores"
                    vazio={porSetor.length === 0}
                  >
                    <GraficoBarrasHorizontais
                      dados={porSetor}
                      categoriaChave="setor"
                      series={[
                        {
                          chave: "total",
                          cor: CORES_GRAFICO.ciano,
                          nome: "NCs no período",
                        },
                      ]}
                    />
                  </PainelGrafico>
                </div>
              </div>
            </section>

            <section id="disciplina" className="sg-insights__secao sg-insights__secao--pendencia">
              <div className="mb-3">
                <h2 className="h5 mb-1">Disciplina</h2>
                <p className="texto-sm texto-suave mb-0">
                  Sugestões são gatilhos do domínio; aplicação continua sendo uma
                  decisão manual autorizada.
                </p>
              </div>
              <div className="row g-3 mb-3">
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Medidas aplicadas"
                    valor={aplicadas.total ?? 0}
                    descricao="Registros disciplinares no período"
                    cor="azul"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Advertências aplicadas"
                    valor={aplicadas.advertencias ?? 0}
                    descricao="Aplicações manuais"
                    cor="amarela"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Suspensões aplicadas"
                    valor={aplicadas.suspensoes ?? 0}
                    descricao="Aplicações manuais"
                    cor="vermelha"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <CardMetrica
                    rotulo="Gatilhos sugeridos"
                    valor={sugeridas.total ?? 0}
                    descricao="Não são aplicados automaticamente"
                    cor="laranja"
                  />
                </div>
              </div>

              {sugestoesDisciplina.length === 0 ? (
                <EstadoVazio
                  titulo="Sem gatilhos disciplinares no período"
                  descricao="Nenhuma ocorrência atingiu um limiar disciplinar dentro do filtro atual."
                />
              ) : (
                <PainelGrafico
                  titulo="Sugestões disciplinares por causa"
                  descricao="Limiar atingido pela ocorrência canônica de cada causa"
                >
                  <GraficoBarrasHorizontais
                    dados={sugestoesDisciplina}
                    categoriaChave="causa"
                    empilhado
                    series={[
                      {
                        chave: "advertencias_sugeridas",
                        cor: CORES_GRAFICO.amarelo,
                        nome: "Advertência",
                      },
                      {
                        chave: "suspensoes_sugeridas",
                        cor: CORES_GRAFICO.vermelho,
                        nome: "Suspensão",
                      },
                      {
                        chave: "avaliacoes_justa_causa_sugeridas",
                        cor: CORES_GRAFICO.violeta,
                        nome: "Avaliar justa causa",
                      },
                    ]}
                  />
                </PainelGrafico>
              )}
            </section>

            <section className="sg-card">
              <div className="sg-card-body p-3 p-md-4">
                <h2 className="h6 mb-2">Como ler estes Insights</h2>
                <div className="row g-3 texto-sm texto-suave">
                  <div className="col-md-4">
                    <strong className="d-block text-body mb-1">Volume</strong>
                    {metodologia.volume}
                  </div>
                  <div className="col-md-4">
                    <strong className="d-block text-body mb-1">Backlog</strong>
                    {metodologia.backlog}
                  </div>
                  <div className="col-md-4">
                    <strong className="d-block text-body mb-1">Tempos</strong>
                    {metodologia.tempos}
                  </div>
                </div>
              </div>
            </section>
          </div>
          </>
        )}
      </Container>
    </div>
  );
}
