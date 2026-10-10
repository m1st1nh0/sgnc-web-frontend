"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import { useAuth } from "../../auth/components/AuthContext.jsx";
import { useOnboarding } from "../../onboarding/components/OnboardingContext.jsx";
import { buscarInsights } from "../client/insightsService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
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
} from "../client/insightsUx.js";
import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import CardMetrica from "../../../components/ui/CardMetrica.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import PainelGrafico from "../../../components/ui/PainelGrafico.jsx";
import Botao from "../../../components/ui/Botao.jsx";
import GraficoBarrasHorizontais from "../../../components/graficos/GraficoBarrasHorizontais.jsx";
import GraficoDonut from "../../../components/graficos/GraficoDonut.jsx";
import GraficoLinha from "../../../components/graficos/GraficoLinha.jsx";
import { CORES_GRAFICO } from "../../../components/graficos/cores.js";
import ModalNcsIndicador from "./ModalNcsIndicador.jsx";
import { urlComFiltros } from "../../../lib/utils/retorno.js";
import { ehQualidade } from "../../../lib/auth/papeis.js";

const CORES_CRITICIDADE = {
  baixa: CORES_GRAFICO.verde,
  media: CORES_GRAFICO.amarelo,
  média: CORES_GRAFICO.amarelo,
  alta: CORES_GRAFICO.vermelho,
};
const ROTULOS_SERIE = {
  total: "registradas",
  concluidas: "concluídas",
  invalidadas: "invalidadas",
  reincidentes: "reincidentes",
};
const seriesLabel = (serie) => ROTULOS_SERIE[String(serie)] || "registradas";

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
  const { concluirEtapa } = useOnboarding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [detalheIndicador, setDetalheIndicador] = useState(null);
  const [filtros, setFiltros] = useState({ inicio: "", fim: "" });
  // Período escolhido pelo usuário; fica na URL para sobreviver ao retorno do detalhe da NC.
  const [periodoUrl] = useState(() => ({
    inicio: searchParams.get("inicio") || "",
    fim: searchParams.get("fim") || "",
  }));
  const [periodoAplicado, setPeriodoAplicado] = useState(periodoUrl);
  const urlAtual = urlComFiltros("/insights", periodoAplicado);

  async function carregar(opcoes = {}) {
    setCarregando(true);
    setErro("");
    try {
      const resultado = await buscarInsights(opcoes);
      if (resultado?.versao_contrato !== "insights-v2") {
        throw new Error("Contrato de Insights incompatível com a interface V2.");
      }
      setDados(resultado);
      const aplicado = { inicio: opcoes.inicio || "", fim: opcoes.fim || "" };
      setPeriodoAplicado(aplicado);
      router.replace(urlComFiltros("/insights", aplicado), { scroll: false });
      void concluirEtapa("checklist_insights", "checklist", {
        escopo: usuario?.papel === "supervisor" ? "equipe_hierarquica" : "organizacao",
      });
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
    carregar({ inicio: periodoUrl.inicio || undefined, fim: periodoUrl.fim || undefined });
    // Carrega somente na montagem; filtros posteriores chamam carregar() diretamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aplicarFiltros(evento) {
    evento.preventDefault();
    if (filtros.inicio && filtros.fim && filtros.inicio > filtros.fim) {
      setErro("A data inicial não pode ser posterior à data final.");
      return;
    }
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

  function abrirDetalhe(titulo, filtro) {
    const inicio = filtros.inicio || dados?.periodo?.inicio;
    const fim = filtros.fim || dados?.periodo?.fim;
    if (!inicio || !fim) return;
    setDetalheIndicador({ titulo, filtro: { ...filtro, inicio, fim } });
  }

  function abrirDimensao(dim, row, label = row?.causa || row?.colaborador || row?.setor || row?.criticidade, serie) {
    if (!row || !label) return;
    if (dim === "colaborador" && row.colaborador_id) {
      abrirDetalhe(`NCs de ${label}`, { tipo: "dimension", dimensao: dim, colaborador_id: row.colaborador_id });
    } else if (dim === "setor") {
      abrirDetalhe(`NCs do setor ${label}`, { tipo: "dimension", dimensao: dim, setor: label });
    } else if (dim === "criticidade") {
      abrirDetalhe(`NCs de criticidade ${label}`, { tipo: "dimension", dimensao: dim, criticidade: label });
    } else if (dim === "causa" && row.causa_id) {
      abrirDetalhe(`NCs relacionadas à causa: ${label}`, {
        tipo: "dimension",
        dimensao: dim,
        causa_id: String(row.causa_id),
        ...(serie ? { serie } : {}),
      });
    }
  }

  const cardInterativo = (titulo, filtro, props) => (
    <button type="button" className="sg-metrica-interativa" onClick={() => abrirDetalhe(titulo, filtro)} aria-label={`Ver NCs: ${titulo}`}>
      <CardMetrica {...props} />
      <span className="sg-metrica-interativa__acao">Ver NCs</span>
    </button>
  );

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
    const naoRespondidas = Number(kpis.nao_respondidas_atual || 0);

    itens.push({
      id: "backlog",
      titulo: backlog === 0 ? "Operação sem pendências" : `${backlog} NC(s) exigem acompanhamento`,
      texto:
        backlog === 0
          ? "Não há NC ativa no escopo neste momento."
          : `${feedback} aguardam feedback, ${aceite} aguardam aceite e ${naoRespondidas} não foram respondidas no prazo.`,
      filtro: { tipo: "backlog" },
    });

    if (dados.aged_backlog?.mais_antiga) {
      const nc = dados.aged_backlog.mais_antiga;
      itens.push({
        id: "nc-mais-antiga",
        titulo: `NC #${nc.nc_id} é a mais antiga`,
        texto: `Está há ${nc.dias_na_etapa} dia(s) na etapa atual.`,
        filtro: { tipo: "record", nc_id: String(nc.nc_id) },
      });
    }

    const causa = porReincidenciaCausa[0];
    itens.push({
      id: "causa-reincidente",
      titulo: causa
        ? `${causa.causa} lidera as reincidências`
        : "Sem reincidência no recorte",
      texto: causa
        ? `${causa.reincidencias_12m} reincidência(s) canônica(s) em 12 meses.`
        : "Nenhuma causa reincidente foi identificada no escopo.",
      filtro: causa?.causa_id
        ? { tipo: "dimension", dimensao: "causa", causa_id: String(causa.causa_id), serie: "reincidencias_12m" }
        : null,
    });
    return itens;
  }, [dados, kpis, porReincidenciaCausa]);

  const podeVer =
    usuario && (ehQualidade(usuario.papel) || usuario.papel === "supervisor");
  if (!podeVer) return null; // O gate server-side da rota valida o papel.

  const maisAntiga = dados?.aged_backlog?.mais_antiga;
  const backlogAtual = Number(kpis.backlog_ativo_atual || 0);
  const disciplina = dados?.disciplina || {};
  const aplicadas = disciplina.aplicadas || {};
  const sugeridas = disciplina.sugeridas || {};

  return (
    <div>
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
                <Form.Group className="col-sm-6 col-lg-3" controlId="insights-inicio">
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
                </Form.Group>
                <Form.Group className="col-sm-6 col-lg-3" controlId="insights-fim">
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
                </Form.Group>
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
        {erro && !dados && !carregando && (
          <Botao variante="secundario" onClick={() => carregar({ inicio: periodoAplicado.inicio || undefined, fim: periodoAplicado.fim || undefined })}>
            Tentar novamente
          </Botao>
        )}

        {dados && (
          <>
          <div className="sg-analiticos-layout sg-insights-layout" aria-busy={carregando}>
            <aside className="sg-analiticos-aside" aria-label="Ações e atalhos dos Insights">
              <section className="sg-card sg-proxima-acao">
                <div className="sg-card-body">
                  <span className="sg-proxima-acao__rotulo">Próxima ação</span>
                  <h2 className="h6 mt-2 mb-2">{leituraExecutiva[0]?.titulo || "Acompanhar a operação"}</h2>
                  <p className="texto-sm mb-3">{leituraExecutiva[0]?.texto || "Consulte os indicadores e as NCs dentro do seu escopo."}</p>
                  {backlogAtual > 0 ? (
                    <button
                      type="button"
                      className="sg-btn sg-btn--primario sg-proxima-acao__botao"
                      onClick={() => leituraExecutiva[0]?.filtro && abrirDetalhe(leituraExecutiva[0].titulo, leituraExecutiva[0].filtro)}
                    >
                      Ver NCs do backlog
                    </button>
                  ) : (
                    <span className="sg-proxima-acao__sem-pendencia" role="status">Sem NCs ativas para tratar</span>
                  )}
                </div>
              </section>

              <section className="sg-card sg-leitura-rapida" aria-labelledby="leitura-executiva">
                <div className="sg-card-body">
                  <span className="sg-leitura-executiva__rotulo">Leitura rápida</span>
                  <h2 id="leitura-executiva" className="h6 mt-2 mb-1">O que os dados indicam</h2>
                  <p className="texto-xs texto-suave mb-3">Resumo para orientar a análise. A decisão continua com a gestão.</p>
                  <div className="sg-leitura-executiva__itens">
                    {leituraExecutiva.slice(1).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="sg-leitura-executiva__item"
                        disabled={!item.filtro}
                        onClick={() => item.filtro && abrirDetalhe(item.titulo, item.filtro)}
                        aria-label={item.filtro ? `Ver NCs: ${item.titulo}` : item.titulo}
                      >
                        <strong>{item.titulo}</strong>
                        <span>{item.texto}</span>
                        {item.filtro && <span className="sg-leitura-executiva__acao">Ver NCs</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <nav className="sg-card sg-atalhos-modulo" aria-label="Ir para seção dos Insights">
                <div className="sg-card-body">
                  <h2 className="h6 mb-2">Atalhos</h2>
                  <a href="#operacao">Operação agora</a>
                  <a href="#movimento">Movimento no período</a>
                  <a href="#tempos">Velocidade do fluxo</a>
                  <a href="#reincidencia">Causas e reincidência</a>
                  <a href="#distribuicao">Distribuição</a>
                  <a href="#disciplina">Disciplina</a>
                </div>
              </nav>
            </aside>

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
                <div className="col-sm-6 col-xl">
                  {cardInterativo("Backlog ativo", { tipo: "backlog" }, {
                    rotulo: "Backlog ativo",
                    valor: kpis.backlog_ativo_atual ?? 0,
                    descricao: "Todas as NCs ativas agora",
                    cor: "azul",
                  })}
                </div>
                <div className="col-sm-6 col-xl">
                  {cardInterativo("NCs aguardando avaliação", { tipo: "backlog", status: "aberta" }, {
                    rotulo: "Aguardando avaliação",
                    valor: kpis.abertas_atuais ?? 0,
                    descricao: "Ainda sem decisão administrativa",
                    cor: "amarela",
                  })}
                </div>
                <div className="col-sm-6 col-xl">
                  {cardInterativo("NCs aguardando feedback", { tipo: "backlog", status: "aguardando_feedback" }, {
                    rotulo: "Aguardando feedback",
                    valor: kpis.aguardando_feedback_atual ?? 0,
                    descricao: "Procedentes aguardando tratamento",
                    cor: "laranja",
                  })}
                </div>
                <div className="col-sm-6 col-xl">
                  {cardInterativo("NCs aguardando aceite", { tipo: "backlog", status: "aguardando_aceite" }, {
                    rotulo: "Aguardando aceite",
                    valor: kpis.aguardando_aceite_atual ?? 0,
                    descricao: "Feedback aplicado, confirmação pendente",
                    cor: "verde",
                  })}
                </div>
                <div className="col-sm-6 col-xl">
                  {cardInterativo("NCs não respondidas", { tipo: "backlog", status: "nao_respondida" }, {
                    rotulo: "Não respondidas",
                    valor: kpis.nao_respondidas_atual ?? 0,
                    descricao: "Prazo de aceite vencido sem resposta",
                    cor: "vermelha",
                  })}
                </div>
              </div>

              <div className="row g-3">
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Backlog por etapa"
                    descricao="Clique em uma etapa para ver as NCs ativas correspondentes"
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
                      onCategoryClick={(row) => {
                        const status = {
                          "Aguardando avaliação": "aberta",
                          "Aguardando feedback": "aguardando_feedback",
                          "Aguardando aceite": "aguardando_aceite",
                          "Não respondidas": "nao_respondida",
                        }[row?.status];
                        if (status) abrirDetalhe(`NCs: ${row.status}`, { tipo: "backlog", status });
                      }}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Aging do backlog"
                    descricao="Clique em uma faixa para ver as NCs correspondentes"
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
                      onCategoryClick={(row) => row?.faixa && abrirDetalhe(`NCs no aging ${row.faixa}`, { tipo: "aging", faixa: row.faixa })}
                    />
                  </PainelGrafico>
                </div>
              </div>
            </section>

            <section id="movimento" className="sg-insights__secao sg-insights__secao--norma">
              <div className="mb-3">
                <h2 className="h5 mb-1">Movimento no período</h2>
                <p className="texto-sm texto-suave mb-0">
                  Volume histórico dentro do intervalo selecionado.
                </p>
              </div>
              <div className="row g-3 mb-3">
                <div className="col-sm-6 col-xl">
                  {cardInterativo("NCs registradas no período", { tipo: "period" }, {
                    rotulo: "NCs registradas",
                    valor: kpis.total_ncs ?? 0,
                    descricao: "Abertas no período",
                    cor: "azul",
                  })}
                </div>
                <div className="col-sm-6 col-xl">
                  {cardInterativo("NCs concluídas no período", { tipo: "concluded" }, {
                    rotulo: "Concluídas no período",
                    valor: kpis.concluidas_no_periodo ?? 0,
                    descricao: "Aceites registrados no intervalo",
                    cor: "verde",
                  })}
                </div>
                <div className="col-sm-6 col-xl">
                  {cardInterativo("NCs invalidadas no período", { tipo: "invalidated" }, {
                    rotulo: "Invalidadas no período",
                    valor: kpis.invalidadas_no_periodo ?? 0,
                    descricao: "Decisões de invalidação no intervalo",
                    cor: "vermelha",
                  })}
                </div>
                <div className="col-sm-6 col-xl">
                  <CardMetrica
                    rotulo="Taxa de invalidação"
                    valor={taxaPercentual(kpis.taxa_invalidacao)}
                    descricao="Invalidadas entre NCs do período"
                    cor="cinza"
                  />
                </div>
                <div className="col-sm-6 col-xl">
                  <CardMetrica
                    rotulo="Aceite no prazo"
                    valor={taxaPercentual(kpis.taxa_aceite_no_prazo)}
                    descricao={kpis.aceites_no_periodo
                      ? `${kpis.aceites_no_prazo} de ${kpis.aceites_no_periodo} aceites do período`
                      : "Sem aceites no período"}
                    cor="verde"
                  />
                </div>
              </div>

              <PainelGrafico
                titulo="Evolução mensal"
                descricao="Clique em um ponto para listar as NCs do mês e da série selecionada"
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
                  onPointClick={(row, serie) => row?.mes && abrirDetalhe(
                    `NCs de ${row.rotuloMes} · ${seriesLabel(serie)}`,
                    { tipo: "mensal", mes: row.mes, serie: String(serie || "total") },
                  )}
                />
              </PainelGrafico>
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
                    descricao="Clique em uma barra para ver as NCs relacionadas à causa"
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
                      onCategoryClick={(row, serie) => abrirDimensao("causa", row, undefined, serie)}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Reincidência por causa"
                    descricao="Clique em uma barra para ver as NCs relacionadas à causa"
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
                      onCategoryClick={(row, serie) => abrirDimensao("causa", row, undefined, serie)}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="Reincidência por colaborador"
                    descricao="Clique em uma barra para ver as NCs do colaborador"
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
                      onCategoryClick={(row) => abrirDimensao("colaborador", row)}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="NCs por criticidade"
                    descricao="Clique em uma categoria para ver as NCs correspondentes"
                    vazio={porCriticidade.length === 0}
                  >
                    <GraficoDonut
                      dados={porCriticidade}
                      onCategoryClick={(row) => abrirDimensao("criticidade", row, row.nome)}
                    />
                  </PainelGrafico>
                </div>
              </div>
            </section>

            <section id="distribuicao" className="sg-insights__secao">
              <div className="mb-3">
                <h2 className="h5 mb-1">Distribuição organizacional</h2>
                <p className="texto-sm texto-suave mb-0">
                  Para supervisores, estes gráficos ficam limitados às pessoas
                  da hierarquia sob sua liderança.
                </p>
              </div>
              <div className="row g-3">
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="NCs por colaborador"
                    descricao="Clique em uma barra para ver as NCs do colaborador"
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
                      onCategoryClick={(row) => abrirDimensao("colaborador", row)}
                    />
                  </PainelGrafico>
                </div>
                <div className="col-lg-6">
                  <PainelGrafico
                    titulo="NCs por setor"
                    descricao="Clique em uma barra para ver as NCs do setor"
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
                        {
                          chave: "nao_respondidas",
                          cor: CORES_GRAFICO.vermelho,
                          nome: "Não respondidas agora",
                        },
                      ]}
                      onCategoryClick={(row) => abrirDimensao("setor", row)}
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
          </div>
          </>
        )}
      </Container>
      {detalheIndicador && (
        <ModalNcsIndicador
          retorno={urlAtual}
          titulo={detalheIndicador.titulo}
          filtro={detalheIndicador.filtro}
          aoFechar={() => setDetalheIndicador(null)}
        />
      )}
    </div>
  );
}
