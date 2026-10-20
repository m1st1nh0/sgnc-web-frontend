"use client";

import { useEffect, useMemo, useState } from "react";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Botao from "../../../components/ui/Botao.jsx";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
import BadgePrioridade from "../../../components/ui/BadgePrioridade.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import PainelGrafico from "../../../components/ui/PainelGrafico.jsx";
import GraficoBarrasHorizontais from "../../../components/graficos/GraficoBarrasHorizontais.jsx";
import GraficoDonut from "../../../components/graficos/GraficoDonut.jsx";
import GraficoLinha from "../../../components/graficos/GraficoLinha.jsx";
import { CORES_GRAFICO } from "../../../components/graficos/cores.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import { listarEquipe, listarOpcoesNc } from "../../users/client/usuarioService.js";
import { buscarInsights, buscarNcsDoIndicador } from "../../insights/client/insightsService.js";
import ModalNcsIndicador from "../../insights/components/ModalNcsIndicador.jsx";
import {
  baixarCsvNcs,
  baixarPdfResumo,
  baixarXlsxNcs,
  nomeArquivoRelatorio,
} from "../client/relatoriosService.js";
import { salvarArquivoLocal } from "../../../lib/utils/arquivoLocal.js";
import { periodoPadraoRelatorio } from "../client/period.js";
import { formatarDuracao, prepararLinhaMensal } from "../../insights/client/insightsUx.js";
import { formatarPeriodo } from "../../../lib/utils/formato.js";
import { comRetorno, urlComFiltros } from "../../../lib/utils/retorno.js";

const STATUS = [
  ["", "Todos os status"],
  ["aberta", "Aguardando avaliação"],
  ["aguardando_feedback", "Aguardando feedback"],
  ["aguardando_aceite", "Aguardando aceite"],
  ["nao_respondida", "Não respondida"],
  ["em_plano_acao", "Em plano de ação"],
  ["em_verificacao", "Em verificação"],
  ["nao_eficaz", "Não eficaz"],
  ["escalada", "Escalada"],
  ["concluida", "Concluída"],
  ["invalidada", "Invalidada"],
];
const STATUS_LABEL = Object.fromEntries(STATUS.filter(([value]) => value));
const STATUS_RAW_LABEL = {
  ...STATUS_LABEL,
  validada: "Aguardando feedback",
  aguardando_analise: "Aguardando feedback",
  reaberta: "Reaberta",
};
const CORES_STATUS = {
  aberta: CORES_GRAFICO.amarelo,
  aguardando_feedback: CORES_GRAFICO.laranja,
  aguardando_aceite: CORES_GRAFICO.violeta,
  nao_respondida: CORES_GRAFICO.vermelho,
  em_plano_acao: CORES_GRAFICO.vermelho,
  em_verificacao: CORES_GRAFICO.violeta,
  nao_eficaz: CORES_GRAFICO.vermelho,
  escalada: CORES_GRAFICO.laranja,
  concluida: CORES_GRAFICO.verde,
  invalidada: CORES_GRAFICO.vermelho,
};
const PALETA_CATEGORIAS = [
  CORES_GRAFICO.azul,
  CORES_GRAFICO.ciano,
  CORES_GRAFICO.verde,
  CORES_GRAFICO.violeta,
  CORES_GRAFICO.laranja,
  CORES_GRAFICO.amarelo,
  CORES_GRAFICO.vermelho,
  CORES_GRAFICO.cinza,
];
const DATA = (value) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

function periodoDozeMeses() {
  const fim = new Date();
  const inicio = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  inicio.setDate(inicio.getDate() - 364);
  return {
    inicio: `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(inicio.getDate()).padStart(2, "0")}`,
    fim: `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}-${String(fim.getDate()).padStart(2, "0")}`,
  };
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Lê da URL o recorte aplicado; datas inválidas voltam ao padrão de 30 dias. */
function filtrosDaUrl(searchParams) {
  const padrao = periodoPadraoRelatorio();
  const data = (chave) => DATA_ISO.test(searchParams.get(chave) || "") ? searchParams.get(chave) : padrao[chave];
  return {
    inicio: data("inicio"),
    fim: data("fim"),
    status: STATUS_LABEL[searchParams.get("status")] ? searchParams.get("status") : "",
    colaboradorId: searchParams.get("colaborador") || "",
    setor: searchParams.get("setor") || "",
  };
}

export default function RelatoriosPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtros, setFiltros] = useState(() => filtrosDaUrl(searchParams));
  const [aplicados, setAplicados] = useState(() => filtrosDaUrl(searchParams));
  const [pessoas, setPessoas] = useState([]);
  const [dados, setDados] = useState(null);
  const [ncs, setNcs] = useState({ items: [], total: 0, por_pagina: 25 });
  const [pagina, setPagina] = useState(() => Math.max(0, Number(searchParams.get("pagina")) || 0));
  // URL atual do relatório: usada no retorno do detalhe para restaurar filtros e página.
  const urlAtual = urlComFiltros(pathname, {
    inicio: aplicados.inicio,
    fim: aplicados.fim,
    status: aplicados.status,
    colaborador: aplicados.colaboradorId,
    setor: aplicados.setor,
    pagina,
  });
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState("");
  const [erro, setErro] = useState("");
  const [detalheIndicador, setDetalheIndicador] = useState(null);
  const [aba, setAba] = useState("geral");

  useEffect(() => {
    let ativo = true;
    (usuario?.papel === "supervisor" ? listarEquipe() : listarOpcoesNc())
      .then((lista) => { if (ativo) setPessoas(lista); })
      .catch((e) => { if (ativo) setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar as opções de filtro."); });
    return () => { ativo = false; };
  }, [usuario?.papel]);

  useEffect(() => {
    let ativo = true;
    const filtrosConsulta = {
      inicio: aplicados.inicio,
      fim: aplicados.fim,
      status: aplicados.status,
      colaboradorId: aplicados.colaboradorId,
      setor: aplicados.setor,
    };
    const filtroLista = {
      tipo: "period",
      inicio: aplicados.inicio,
      fim: aplicados.fim,
      ...(aplicados.status ? { filtro_status: aplicados.status } : {}),
      ...(aplicados.colaboradorId ? { filtro_colaborador_id: aplicados.colaboradorId } : {}),
      ...(aplicados.setor ? { filtro_setor: aplicados.setor } : {}),
    };
    Promise.all([
      buscarInsights(filtrosConsulta),
      buscarNcsDoIndicador(filtroLista, pagina),
    ])
      .then(([resultado, lista]) => {
        if (!ativo) return;
        setDados(resultado);
        setNcs(lista);
        setErro("");
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof ErroApi ? e.message : e?.message || "Não foi possível gerar o relatório na tela.");
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [aplicados, pagina]);

  useEffect(() => {
    router.replace(urlAtual, { scroll: false });
  }, [router, urlAtual]);

  const setores = useMemo(
    () => [...new Set(pessoas.map((p) => p.setor).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [pessoas],
  );
  const statusData = useMemo(
    () => (dados?.ncs_por_status || []).map((item) => ({ ...item, rotulo: STATUS_RAW_LABEL[item.status] || item.status, cor: CORES_STATUS[item.status] || CORES_GRAFICO.cinza })),
    [dados],
  );
  const criticidadeData = useMemo(
    () => (dados?.ncs_por_criticidade || []).map((item) => {
      const criticidade = String(item.criticidade || "").toLocaleLowerCase("pt-BR");
      const cor = criticidade === "alta" ? CORES_GRAFICO.vermelho
        : ["média", "media"].includes(criticidade) ? CORES_GRAFICO.amarelo
          : criticidade === "baixa" ? CORES_GRAFICO.verde : CORES_GRAFICO.cinza;
      return { nome: item.criticidade, valor: item.total, cor };
    }),
    [dados],
  );
  const setoresData = useMemo(() => (dados?.ncs_por_setor || []).slice(0, 10).map((item, index) => ({ ...item, cor: PALETA_CATEGORIAS[index % PALETA_CATEGORIAS.length] })), [dados]);
  const colaboradoresData = useMemo(() => (dados?.ncs_por_colaborador || []).slice(0, 10).map((item, index) => ({ ...item, cor: PALETA_CATEGORIAS[index % PALETA_CATEGORIAS.length] })), [dados]);
  const mesesData = useMemo(() => prepararLinhaMensal(dados?.ncs_por_mes), [dados]);
  const kpis = dados?.kpis || {};
  const totalPaginas = Math.max(1, Math.ceil((ncs.total || 0) / (ncs.por_pagina || 25)));
  const escopo = usuario?.papel === "supervisor" ? "Sua equipe hierárquica" : "Toda a organização";

  function alterar(chave, valor) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
  }

  function aplicar(proximos) {
    if (proximos.inicio && proximos.fim && proximos.inicio > proximos.fim) {
      setErro("A data inicial não pode ser posterior à data final.");
      return;
    }
    setErro("");
    setCarregando(true);
    setPagina(0);
    setAplicados({ ...proximos });
  }

  function aplicarFiltros(evento) {
    evento.preventDefault();
    aplicar(filtros);
  }

  // Atalhos de período aplicam imediatamente, mantendo os demais filtros.
  function aplicarPeriodo(periodo) {
    const proximos = { ...filtros, ...periodo };
    setFiltros(proximos);
    aplicar(proximos);
  }

  function abrirDetalhe(titulo, filtro) {
    setDetalheIndicador({
      titulo,
      filtro: {
        ...filtro,
        inicio: aplicados.inicio,
        fim: aplicados.fim,
        ...(aplicados.status ? { filtro_status: aplicados.status } : {}),
        ...(aplicados.colaboradorId ? { filtro_colaborador_id: aplicados.colaboradorId } : {}),
        ...(aplicados.setor ? { filtro_setor: aplicados.setor } : {}),
      },
    });
  }

  async function gerar(tipo) {
    setErro("");
    setBaixando(tipo);
    try {
      const baixar = { pdf: baixarPdfResumo, xlsx: baixarXlsxNcs, csv: baixarCsvNcs }[tipo];
      const blob = await baixar(aplicados);
      salvarArquivoLocal(blob, nomeArquivoRelatorio(tipo, aplicados));
    } catch (e) {
      const nome = { pdf: "do relatório em PDF", xlsx: "da planilha Excel", csv: "do CSV" }[tipo];
      setErro(e instanceof ErroApi ? e.message : `Não foi possível gerar o arquivo ${nome}. Tente de novo em instantes.`);
    } finally {
      setBaixando("");
    }
  }

  function atualizarPagina(proxima) {
    setCarregando(true);
    setPagina(proxima);
  }

  const numero = (titulo, filtro, rotulo, valor, detalhe) => (
    <button type="button" className="sg-numero" onClick={() => abrirDetalhe(titulo, filtro)} aria-label={`Ver NCs: ${titulo}, ${valor}`}>
      <span className="sg-numero__rotulo">{rotulo}</span>
      <span className="sg-numero__valor">{valor}{detalhe && <small>{detalhe}</small>}</span>
    </button>
  );
  const percentual = (taxa) => taxa == null ? "—" : `${(taxa * 100).toFixed(1).replace(".", ",")}%`;
  const totalStatus = statusData.reduce((soma, item) => soma + (item.quantidade || 0), 0);
  const ABAS = [
    { chave: "geral", rotulo: "Visão geral" },
    { chave: "setor", rotulo: "Por setor" },
    { chave: "colaborador", rotulo: "Por colaborador" },
    { chave: "prazos", rotulo: "Prazos e aceites" },
  ];
  const ocupado = carregando || Boolean(baixando);

  return (
    <div>
      <Container className="sg-container sg-relatorio">
        <div className="sg-relatorio__grade">
          <aside className="sg-cartao sg-relatorio__filtros" aria-labelledby="filtros-relatorio">
            <div className="sg-relatorio__filtros-topo">
              <h2 id="filtros-relatorio" className="sg-secao-titulo mb-0">Filtros</h2>
              <button type="button" className="sg-link-botao" disabled={ocupado}
                onClick={() => aplicarPeriodo({ ...periodoPadraoRelatorio(), status: "", colaboradorId: "", setor: "" })}>Limpar</button>
            </div>
            <Form onSubmit={aplicarFiltros} className="sg-relatorio__form">
              <fieldset className="sg-relatorio__periodo">
                <legend className="sg-label">Período</legend>
                <div className="sg-abas" role="group" aria-label="Atalhos de período">
                  <button type="button" className="sg-abas__item" disabled={ocupado} onClick={() => aplicarPeriodo(periodoPadraoRelatorio())}>Últimos 30 dias</button>
                  <button type="button" className="sg-abas__item" disabled={ocupado} onClick={() => aplicarPeriodo(periodoDozeMeses())}>Últimos 12 meses</button>
                </div>
                <Form.Group controlId="relatorio-inicio">
                  <Form.Label className="sg-label">Início</Form.Label>
                  <Form.Control type="date" className="sg-input" value={filtros.inicio} onChange={(e) => alterar("inicio", e.target.value)} disabled={ocupado} />
                </Form.Group>
                <Form.Group controlId="relatorio-fim">
                  <Form.Label className="sg-label">Fim</Form.Label>
                  <Form.Control type="date" className="sg-input" value={filtros.fim} onChange={(e) => alterar("fim", e.target.value)} disabled={ocupado} />
                </Form.Group>
              </fieldset>
              <Form.Group controlId="relatorio-status">
                <Form.Label className="sg-label">Status</Form.Label>
                <Form.Select className="sg-input" value={filtros.status} onChange={(e) => alterar("status", e.target.value)} disabled={ocupado}>
                  {STATUS.map(([value, label]) => <option value={value} key={value || "todos"}>{label}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group controlId="relatorio-setor">
                <Form.Label className="sg-label">Setor</Form.Label>
                <Form.Select className="sg-input" value={filtros.setor} onChange={(e) => alterar("setor", e.target.value)} disabled={ocupado}>
                  <option value="">Todos os setores</option>
                  {setores.map((setor) => <option value={setor} key={setor}>{setor}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group controlId="relatorio-colaborador">
                <Form.Label className="sg-label">Colaborador</Form.Label>
                <Form.Select className="sg-input" value={filtros.colaboradorId} onChange={(e) => alterar("colaboradorId", e.target.value)} disabled={ocupado}>
                  <option value="">Todos os colaboradores</option>
                  {pessoas.map((pessoa) => <option value={pessoa.id} key={pessoa.id}>{pessoa.nome}</option>)}
                </Form.Select>
              </Form.Group>
              <Botao type="submit" variante="primario" className="w-100" carregando={carregando} disabled={Boolean(baixando)}>Aplicar filtros</Botao>
              <p className="sg-texto-apoio mb-0">Os atalhos aplicam o período na hora; os demais filtros valem ao clicar em Aplicar.</p>
            </Form>
          </aside>

          <div className="sg-relatorio__conteudo">
            <header className="sg-pagina-cabecalho">
              <div className="sg-pagina-cabecalho__texto">
                <h1>Relatório operacional</h1>
                <p>Visão na tela · {escopo} · {formatarPeriodo(aplicados.inicio, aplicados.fim)}</p>
              </div>
              <div className="sg-pagina-cabecalho__acoes">
                <Botao variante="secundario" type="button" carregando={baixando === "csv"} disabled={ocupado} onClick={() => gerar("csv")}
                  title="Uma linha por NC, 15 colunas, para abrir em qualquer programa">CSV simples</Botao>
                <Botao variante="secundario" type="button" carregando={baixando === "pdf"} disabled={ocupado} onClick={() => gerar("pdf")}
                  title="Relatório gerencial: resumo na primeira página e detalhe nas seguintes">Baixar PDF</Botao>
                <Botao variante="primario" type="button" carregando={baixando === "xlsx"} disabled={ocupado} onClick={() => gerar("xlsx")}
                  title="Planilha com abas: NCs, Causas, Feedback, Linha do tempo, Indicadores e Leia-me">Baixar Excel</Botao>
              </div>
            </header>

            {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
            {carregando && !dados ? <EstadoCarregamento mensagem="Montando o relatório..." /> : null}
            {!carregando && !dados && erro ? (
              <Botao variante="secundario" onClick={() => { setCarregando(true); setAplicados((atual) => ({ ...atual })); }}>Tentar novamente</Botao>
            ) : null}
            <p className="visually-hidden" role="status">{carregando && dados ? "Atualizando relatório…" : ""}</p>

            {dados && (
              <div className="sg-relatorio__secoes" aria-busy={carregando}>
                <div className="sg-relatorio__abas" role="tablist" aria-label="Seções do relatório">
                  {ABAS.map((item) => (
                    <button key={item.chave} type="button" role="tab" id={`aba-relatorio-${item.chave}`} aria-selected={aba === item.chave}
                      aria-controls={`painel-relatorio-${item.chave}`} tabIndex={aba === item.chave ? 0 : -1} className="sg-relatorio__aba"
                      onClick={() => setAba(item.chave)}
                      onKeyDown={(evento) => {
                        if (!["ArrowRight", "ArrowLeft"].includes(evento.key)) return;
                        const indice = ABAS.findIndex((x) => x.chave === aba);
                        const proximo = ABAS[(indice + (evento.key === "ArrowRight" ? 1 : ABAS.length - 1)) % ABAS.length];
                        setAba(proximo.chave);
                        document.getElementById(`aba-relatorio-${proximo.chave}`)?.focus();
                      }}>{item.rotulo}</button>
                  ))}
                </div>

                <div role="tabpanel" id={`painel-relatorio-${aba}`} aria-labelledby={`aba-relatorio-${aba}`} className="sg-relatorio__painel">
                  {aba === "geral" && <>
                    <section className="sg-numeros" aria-label="Números do período">
                      {numero("NCs registradas", { tipo: "period" }, "Registradas", kpis.total_ncs ?? 0)}
                      {numero("Backlog ativo", { tipo: "backlog" }, "Backlog ativo", kpis.backlog_ativo_atual ?? 0)}
                      {numero("Não respondidas", { tipo: "backlog", status: "nao_respondida" }, "Não respondidas", kpis.nao_respondidas_atual ?? 0)}
                      {numero("NCs concluídas", { tipo: "concluded" }, "Concluídas", kpis.concluidas_no_periodo ?? 0)}
                      {numero("NCs invalidadas", { tipo: "invalidated" }, "Invalidadas", kpis.invalidadas_no_periodo ?? 0, percentual(kpis.taxa_invalidacao))}
                    </section>
                    <section className="sg-cartao" aria-labelledby="distribuicao-status">
                      <h2 id="distribuicao-status" className="sg-secao-titulo">Onde estão as {totalStatus} NCs</h2>
                      {statusData.length ? <>
                        <div className="sg-distribuicao" role="img" aria-label={statusData.map((item) => `${item.rotulo} ${item.quantidade}`).join(", ")}>
                          {statusData.map((item) => <span key={item.status} style={{ flexGrow: item.quantidade, background: item.cor }} />)}
                        </div>
                        <ul className="sg-distribuicao__legenda">
                          {statusData.map((item) => (
                            <li key={item.status}>
                              <button type="button" onClick={() => abrirDetalhe(`NCs: ${item.rotulo}`, { tipo: "period", filtro_status: item.status })}>
                                <span className="sg-distribuicao__cor" style={{ background: item.cor }} aria-hidden="true" />
                                <span>{item.rotulo}</span>
                                <strong>{item.quantidade}</strong>
                                <span className="sg-texto-apoio">{totalStatus ? Math.round(item.quantidade / totalStatus * 100) : 0}%</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </> : <p className="sg-texto-apoio mb-0">Sem NCs neste recorte.</p>}
                    </section>
                    <div className="sg-relatorio__graficos">
                      <PainelGrafico titulo="NCs por criticidade" descricao="Selecione uma criticidade para abrir as NCs" vazio={!criticidadeData.length}>
                        <GraficoDonut dados={criticidadeData} onCategoryClick={(row) => abrirDetalhe(`NCs de criticidade ${row.nome}`, { tipo: "dimension", dimensao: "criticidade", criticidade: row.nome })} />
                      </PainelGrafico>
                      <PainelGrafico titulo="Movimento mensal" descricao="Selecione um ponto para abrir as NCs daquele mês" vazio={!mesesData.length}>
                        <GraficoLinha dados={mesesData} eixoChave="rotuloMes" series={[{ chave: "total", cor: CORES_GRAFICO.azul, nome: "Registradas" }, { chave: "concluidas", cor: CORES_GRAFICO.verde, nome: "Concluídas" }, { chave: "invalidadas", cor: CORES_GRAFICO.vermelho, nome: "Invalidadas" }]} onPointClick={(row) => abrirDetalhe(`NCs de ${row.rotuloMes}`, { tipo: "mensal", mes: row.mes, serie: "total" })} />
                      </PainelGrafico>
                    </div>
                  </>}

                  {aba === "setor" && <>
                    <PainelGrafico titulo="NCs por setor" descricao="Selecione um setor para ver as NCs correspondentes" vazio={!setoresData.length}>
                      <GraficoBarrasHorizontais dados={setoresData} categoriaChave="setor" corChave="cor" series={[{ chave: "total", cor: CORES_GRAFICO.ciano, nome: "NCs" }]} altura={Math.max(220, setoresData.length * 44)} onCategoryClick={(row) => abrirDetalhe(`NCs do setor ${row.setor}`, { tipo: "dimension", dimensao: "setor", setor: row.setor })} />
                    </PainelGrafico>
                    {setoresData.length > 0 && <div className="sg-tabela-caixa">
                      <table className="sg-tabela">
                        <caption className="visually-hidden">NCs por setor no período</caption>
                        <thead><tr><th scope="col">Setor</th><th scope="col">NCs no período</th><th scope="col">Invalidadas</th><th scope="col">Backlog ativo</th><th scope="col">Não respondidas</th></tr></thead>
                        <tbody>{(dados.ncs_por_setor || []).map((item) => (
                          <tr key={item.setor}><th scope="row">{item.setor}</th><td>{item.total ?? 0}</td><td>{item.invalidadas ?? 0}</td><td>{item.backlog_ativo ?? 0}</td><td>{item.nao_respondidas ?? 0}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>}
                  </>}

                  {aba === "colaborador" && <>
                    <PainelGrafico titulo="NCs por colaborador" descricao="Selecione um colaborador para abrir suas NCs" vazio={!colaboradoresData.length}>
                      <GraficoBarrasHorizontais dados={colaboradoresData} categoriaChave="colaborador" corChave="cor" series={[{ chave: "total", cor: CORES_GRAFICO.azul, nome: "NCs" }]} altura={Math.max(240, colaboradoresData.length * 44)} onCategoryClick={(row) => row.colaborador_id && abrirDetalhe(`NCs de ${row.colaborador}`, { tipo: "dimension", dimensao: "colaborador", colaborador_id: row.colaborador_id })} />
                    </PainelGrafico>
                    {colaboradoresData.length > 0 && <div className="sg-tabela-caixa">
                      <table className="sg-tabela">
                        <caption className="visually-hidden">NCs por colaborador no período</caption>
                        <thead><tr><th scope="col">Colaborador</th><th scope="col">Setor</th><th scope="col">NCs no período</th><th scope="col">Reincidências (12 meses)</th><th scope="col">Backlog ativo</th></tr></thead>
                        <tbody>{(dados.ncs_por_colaborador || []).map((item) => (
                          <tr key={item.colaborador_id || item.colaborador}><th scope="row">{item.colaborador}</th><td>{item.setor || "—"}</td><td>{item.total ?? 0}</td><td>{item.reincidencias_12m ?? 0}</td><td>{item.backlog_ativo ?? 0}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>}
                  </>}

                  {aba === "prazos" && <>
                    <section className="sg-numeros" aria-label="Prazos e aceites">
                      {numero("Aguardando aceite", { tipo: "backlog", status: "aguardando_aceite" }, "Aguardando aceite", kpis.aguardando_aceite_atual ?? 0)}
                      {numero("Não respondidas", { tipo: "backlog", status: "nao_respondida" }, "Não respondidas", kpis.nao_respondidas_atual ?? 0)}
                      {numero("NCs concluídas", { tipo: "concluded" }, "Aceites no período", kpis.aceites_no_periodo ?? 0)}
                      <div className="sg-numero sg-numero--estatico">
                        <span className="sg-numero__rotulo">Aceites no prazo</span>
                        <span className="sg-numero__valor">{kpis.aceites_no_prazo ?? 0}<small>{percentual(kpis.taxa_aceite_no_prazo)}</small></span>
                      </div>
                    </section>
                    <section className="sg-cartao" aria-labelledby="tempos-aceite">
                      <h2 id="tempos-aceite" className="sg-secao-titulo">Tempos do fluxo no período</h2>
                      <dl className="sg-dados">
                        <div><dt>Abertura → avaliação</dt><dd>{formatarDuracao(dados.tempos?.criacao_ate_validacao?.mediana_segundos)}</dd></div>
                        <div><dt>Avaliação → feedback</dt><dd>{formatarDuracao(dados.tempos?.validacao_ate_feedback?.mediana_segundos)}</dd></div>
                        <div><dt>Feedback → aceite</dt><dd>{formatarDuracao(dados.tempos?.feedback_ate_aceite?.mediana_segundos)}</dd></div>
                        <div><dt>Ciclo total</dt><dd>{formatarDuracao(dados.tempos?.ciclo_total?.mediana_segundos)}</dd></div>
                      </dl>
                      <p className="sg-texto-apoio mt-3 mb-0">Medianas das transições concluídas no período. O prazo do aceite é de 2 dias úteis, contados só no expediente.</p>
                    </section>
                  </>}
                </div>

                <section className="sg-cartao sg-relatorio__lista" aria-labelledby="lista-ncs-relatorio">
                  <div className="sg-relatorio__lista-topo">
                    <div>
                      <h2 id="lista-ncs-relatorio" className="sg-secao-titulo mb-1">NCs do período</h2>
                      <p className="sg-texto-apoio mb-0">{ncs.total} resultado(s). Abra uma linha para consultar o registro completo.</p>
                    </div>
                    <span className="sg-texto-apoio">Página {pagina + 1} de {totalPaginas}</span>
                  </div>
                  {ncs.items?.length ? (
                    <div className="sg-tabela-caixa">
                      <table className="sg-tabela">
                        <thead><tr><th scope="col">NC</th><th scope="col">Data</th><th scope="col">Colaborador</th><th scope="col">Setor</th><th scope="col">Status</th><th scope="col">Criticidade</th><th scope="col"><span className="visually-hidden">Abrir</span></th></tr></thead>
                        <tbody>{ncs.items.map((nc) => (
                          <tr key={nc.id}>
                            <th scope="row" className="sg-mono">#{nc.id}</th>
                            <td>{DATA(nc.data || nc.criado_em)}</td>
                            <td>{nc.colaborador || "—"}</td>
                            <td>{nc.setor || "—"}</td>
                            <td><BadgeStatus status={nc.status} /></td>
                            <td><BadgePrioridade criticidade={nc.criticidade} /></td>
                            <td className="text-end"><Link className="sg-tabela__link" href={comRetorno(`/nc/${nc.id}`, urlAtual)} aria-label={`Abrir NC ${nc.id}`}>Abrir</Link></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : !carregando ? <EstadoVazio titulo="Sem NCs neste recorte" descricao="Altere o período ou remova filtros para ampliar os resultados." /> : null}
                  {totalPaginas > 1 && <nav className="d-flex justify-content-end gap-2 mt-3" aria-label="Paginação das NCs do período">
                    <Botao variante="secundario" type="button" disabled={pagina === 0 || carregando} onClick={() => atualizarPagina(pagina - 1)}>Anterior</Botao>
                    <Botao variante="secundario" type="button" disabled={pagina + 1 >= totalPaginas || carregando} onClick={() => atualizarPagina(pagina + 1)}>Próxima</Botao>
                  </nav>}
                </section>
              </div>
            )}
          </div>
        </div>
      </Container>
      {detalheIndicador && <ModalNcsIndicador titulo={detalheIndicador.titulo} filtro={detalheIndicador.filtro} retorno={urlAtual} aoFechar={() => setDetalheIndicador(null)} />}
    </div>
  );
}
