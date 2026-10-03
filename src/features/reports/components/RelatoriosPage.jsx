"use client";

import { useEffect, useMemo, useState } from "react";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Link from "next/link";

import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import Botao from "../../../components/ui/Botao.jsx";
import CardMetrica from "../../../components/ui/CardMetrica.jsx";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
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
  nomeArquivoRelatorio,
} from "../client/relatoriosService.js";
import { salvarArquivoLocal } from "../../../lib/utils/arquivoLocal.js";
import { periodoPadraoRelatorio } from "../client/period.js";

const STATUS = [
  ["", "Todos os status"],
  ["aberta", "Aguardando avaliação"],
  ["aguardando_feedback", "Aguardando feedback"],
  ["aguardando_aceite", "Aguardando aceite"],
  ["concluida", "Concluída"],
  ["invalidada", "Invalidada"],
];
const STATUS_LABEL = Object.fromEntries(STATUS.filter(([value]) => value));
const STATUS_RAW_LABEL = {
  ...STATUS_LABEL,
  validada: "Aguardando feedback",
  aguardando_analise: "Aguardando feedback",
};
const CORES_STATUS = {
  aberta: CORES_GRAFICO.amarelo,
  aguardando_feedback: CORES_GRAFICO.laranja,
  aguardando_aceite: CORES_GRAFICO.violeta,
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

export default function RelatoriosPage() {
  const { usuario } = useAuth();
  const [filtros, setFiltros] = useState(() => ({ ...periodoPadraoRelatorio(), status: "", colaboradorId: "", setor: "" }));
  const [aplicados, setAplicados] = useState(() => ({ ...periodoPadraoRelatorio(), status: "", colaboradorId: "", setor: "" }));
  const [pessoas, setPessoas] = useState([]);
  const [dados, setDados] = useState(null);
  const [ncs, setNcs] = useState({ items: [], total: 0, por_pagina: 25 });
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState("");
  const [erro, setErro] = useState("");
  const [detalheIndicador, setDetalheIndicador] = useState(null);

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
  const mesesData = useMemo(() => dados?.ncs_por_mes || [], [dados]);
  const kpis = dados?.kpis || {};
  const totalPaginas = Math.max(1, Math.ceil((ncs.total || 0) / (ncs.por_pagina || 25)));
  const escopo = usuario?.papel === "supervisor" ? "Sua equipe hierárquica" : "Toda a organização";

  function alterar(chave, valor) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
  }

  function aplicarFiltros(evento) {
    evento.preventDefault();
    if (filtros.inicio && filtros.fim && filtros.inicio > filtros.fim) {
      setErro("A data inicial não pode ser posterior à data final.");
      return;
    }
    setErro("");
    setCarregando(true);
    setPagina(0);
    setAplicados({ ...filtros });
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
      const blob = tipo === "pdf" ? await baixarPdfResumo(aplicados) : await baixarCsvNcs(aplicados);
      salvarArquivoLocal(blob, nomeArquivoRelatorio(tipo, aplicados));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : `Não foi possível gerar o arquivo ${tipo.toUpperCase()}.`);
    } finally {
      setBaixando("");
    }
  }

  function atualizarPagina(proxima) {
    setCarregando(true);
    setPagina(proxima);
  }

  const card = (titulo, filtro, props) => (
    <button type="button" className="sg-metrica-interativa" onClick={() => abrirDetalhe(titulo, filtro)} aria-label={`Ver NCs: ${titulo}`}>
      <CardMetrica {...props} />
      <span className="sg-metrica-interativa__acao">Ver NCs</span>
    </button>
  );

  return (
    <div>
      <Container className="sg-container" style={{ maxWidth: "1280px" }}>
        <CabecalhoPagina
          titulo="Relatório operacional"
          subtitulo={`Visão na tela · ${escopo} · ${aplicados.inicio} a ${aplicados.fim}`}
        />

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        <section className="sg-card mb-4" aria-labelledby="filtros-relatorio">
          <div className="sg-card-body p-3 p-md-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h2 id="filtros-relatorio" className="h6 mb-1">Período e filtros</h2>
                <p className="texto-sm texto-suave mb-0">O relatório começa nos últimos 30 dias. Os filtros atualizam os indicadores, gráficos e a lista de NCs.</p>
              </div>
              <div className="d-flex gap-2">
                <Botao variante="secundario" type="button" disabled={carregando} onClick={() => setFiltros((atual) => ({ ...atual, ...periodoPadraoRelatorio() }))}>Últimos 30 dias</Botao>
                <Botao variante="secundario" type="button" disabled={carregando} onClick={() => setFiltros((atual) => ({ ...atual, ...periodoDozeMeses() }))}>Últimos 12 meses</Botao>
              </div>
            </div>

            <Form onSubmit={aplicarFiltros}>
              <div className="row g-3 align-items-end">
                <div className="col-sm-6 col-lg-2">
                  <Form.Label className="sg-label">Início</Form.Label>
                  <Form.Control type="date" className="sg-input" value={filtros.inicio} onChange={(e) => alterar("inicio", e.target.value)} disabled={carregando || Boolean(baixando)} />
                </div>
                <div className="col-sm-6 col-lg-2">
                  <Form.Label className="sg-label">Fim</Form.Label>
                  <Form.Control type="date" className="sg-input" value={filtros.fim} onChange={(e) => alterar("fim", e.target.value)} disabled={carregando || Boolean(baixando)} />
                </div>
                <div className="col-sm-6 col-lg-2">
                  <Form.Label className="sg-label">Status</Form.Label>
                  <Form.Select className="sg-input" value={filtros.status} onChange={(e) => alterar("status", e.target.value)} disabled={carregando || Boolean(baixando)}>
                    {STATUS.map(([value, label]) => <option value={value} key={value || "todos"}>{label}</option>)}
                  </Form.Select>
                </div>
                <div className="col-sm-6 col-lg-3">
                  <Form.Label className="sg-label">Colaborador</Form.Label>
                  <Form.Select className="sg-input" value={filtros.colaboradorId} onChange={(e) => alterar("colaboradorId", e.target.value)} disabled={carregando || Boolean(baixando)}>
                    <option value="">Todos os colaboradores</option>
                    {pessoas.map((pessoa) => <option value={pessoa.id} key={pessoa.id}>{pessoa.nome}</option>)}
                  </Form.Select>
                </div>
                <div className="col-sm-6 col-lg-2">
                  <Form.Label className="sg-label">Setor</Form.Label>
                  <Form.Select className="sg-input" value={filtros.setor} onChange={(e) => alterar("setor", e.target.value)} disabled={carregando || Boolean(baixando)}>
                    <option value="">Todos os setores</option>
                    {setores.map((setor) => <option value={setor} key={setor}>{setor}</option>)}
                  </Form.Select>
                </div>
                <div className="col-lg-1 d-grid">
                  <Botao type="submit" variante="primario" carregando={carregando} disabled={Boolean(baixando)}>Aplicar</Botao>
                </div>
              </div>
            </Form>
          </div>
        </section>

        {carregando && !dados ? <EstadoCarregamento mensagem="Montando o relatório..." /> : null}
        {carregando && dados ? <p className="texto-sm texto-suave" role="status">Atualizando relatório…</p> : null}

        {dados && (
          <>
            <div className="sg-analiticos-layout sg-relatorios-layout">
              <div className="sg-analiticos-conteudo">
                <div className="mb-3">
                  <h2 className="h5 mb-1">Resumo do período</h2>
                  <p className="texto-sm texto-suave mb-0">Indicadores e registros atualizados para os filtros aplicados.</p>
                </div>

            <div className="row g-3 mb-4">
              <div className="col-sm-6 col-xl-3">{card("NCs registradas", { tipo: "period" }, { rotulo: "NCs registradas", valor: kpis.total_ncs ?? 0, descricao: "Abertas no período", cor: "azul" })}</div>
              <div className="col-sm-6 col-xl-3">{card("Backlog ativo", { tipo: "backlog" }, { rotulo: "Backlog ativo", valor: kpis.backlog_ativo_atual ?? 0, descricao: "Aguardam alguma ação", cor: "laranja" })}</div>
              <div className="col-sm-6 col-xl-3">{card("NCs concluídas", { tipo: "concluded" }, { rotulo: "Concluídas", valor: kpis.concluidas_no_periodo ?? 0, descricao: "Aceites no período", cor: "verde" })}</div>
              <div className="col-sm-6 col-xl-3">{card("NCs invalidadas", { tipo: "invalidated" }, { rotulo: "Invalidadas", valor: kpis.invalidadas_no_periodo ?? 0, descricao: `${((kpis.taxa_invalidacao || 0) * 100).toFixed(1).replace(".", ",")}% do total`, cor: "vermelha" })}</div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-lg-6">
                <PainelGrafico titulo="NCs por status" descricao="Selecione um status para filtrar a lista de NCs" vazio={!statusData.length}>
                  <GraficoBarrasHorizontais dados={statusData} categoriaChave="rotulo" corChave="cor" series={[{ chave: "quantidade", cor: CORES_GRAFICO.azul, nome: "NCs" }]} altura={250} onCategoryClick={(row) => abrirDetalhe(`NCs: ${row.rotulo}`, { tipo: "period", filtro_status: row.status })} />
                </PainelGrafico>
              </div>
              <div className="col-lg-6">
                <PainelGrafico titulo="NCs por setor" descricao="Selecione um setor para ver as NCs correspondentes" vazio={!setoresData.length}>
                  <GraficoBarrasHorizontais dados={setoresData} categoriaChave="setor" corChave="cor" series={[{ chave: "total", cor: CORES_GRAFICO.ciano, nome: "NCs" }]} altura={250} onCategoryClick={(row) => abrirDetalhe(`NCs do setor ${row.setor}`, { tipo: "dimension", dimensao: "setor", setor: row.setor })} />
                </PainelGrafico>
              </div>
              <div className="col-lg-6">
                <PainelGrafico titulo="NCs por colaborador" descricao="Selecione um colaborador para abrir suas NCs" vazio={!colaboradoresData.length}>
                  <GraficoBarrasHorizontais dados={colaboradoresData} categoriaChave="colaborador" corChave="cor" series={[{ chave: "total", cor: CORES_GRAFICO.azul, nome: "NCs" }]} altura={280} onCategoryClick={(row) => row.colaborador_id && abrirDetalhe(`NCs de ${row.colaborador}`, { tipo: "dimension", dimensao: "colaborador", colaborador_id: row.colaborador_id })} />
                </PainelGrafico>
              </div>
              <div className="col-lg-6">
                <PainelGrafico titulo="NCs por criticidade" descricao="Selecione uma criticidade para abrir as NCs" vazio={!criticidadeData.length}>
                  <GraficoDonut dados={criticidadeData} onCategoryClick={(row) => abrirDetalhe(`NCs de criticidade ${row.nome}`, { tipo: "dimension", dimensao: "criticidade", criticidade: row.nome })} />
                </PainelGrafico>
              </div>
              <div className="col-12">
                <PainelGrafico titulo="Movimento mensal" descricao="Selecione um ponto para abrir as NCs daquele mês" vazio={!mesesData.length}>
                  <GraficoLinha dados={mesesData} eixoChave="mes" series={[{ chave: "total", cor: CORES_GRAFICO.azul, nome: "Registradas" }, { chave: "concluidas", cor: CORES_GRAFICO.verde, nome: "Concluídas" }, { chave: "invalidadas", cor: CORES_GRAFICO.vermelho, nome: "Invalidadas" }]} onPointClick={(row) => abrirDetalhe(`NCs de ${row.mes}`, { tipo: "mensal", mes: row.mes, serie: "total" })} />
                </PainelGrafico>
              </div>
            </div>

            <section className="sg-card mb-5" aria-labelledby="lista-ncs-relatorio">
              <div className="sg-card-body p-3 p-md-4">
                <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
                  <div>
                    <h2 id="lista-ncs-relatorio" className="h5 mb-1">NCs do período</h2>
                    <p className="texto-sm texto-suave mb-0">{ncs.total} resultado(s). Abra uma linha para consultar o registro completo.</p>
                  </div>
                  <span className="texto-sm texto-suave">Página {pagina + 1} de {totalPaginas}</span>
                </div>
                {ncs.items?.length ? (
                  <div className="table-responsive">
                    <Table hover className="align-middle mb-3">
                      <thead><tr><th scope="col">NC</th><th scope="col">Data</th><th scope="col">Colaborador</th><th scope="col">Setor</th><th scope="col">Status</th><th scope="col">Criticidade</th><th scope="col"><span className="visually-hidden">Abrir</span></th></tr></thead>
                      <tbody>{ncs.items.map((nc) => (
                        <tr key={nc.id}>
                          <th scope="row">#{nc.id}</th>
                          <td>{DATA(nc.data || nc.criado_em)}</td>
                          <td>{nc.colaborador || "—"}</td>
                          <td>{nc.setor || "—"}</td>
                          <td><BadgeStatus status={nc.status} /></td>
                          <td>{nc.criticidade || "—"}</td>
                          <td><Botao as={Link} href={`/nc/${nc.id}?retorno=${encodeURIComponent("/relatorios")}`} variante="secundario" size="sm">Abrir</Botao></td>
                        </tr>
                      ))}</tbody>
                    </Table>
                  </div>
                ) : !carregando ? <EstadoVazio titulo="Sem NCs neste recorte" descricao="Altere o período ou remova filtros para ampliar os resultados." /> : null}
                <div className="d-flex justify-content-end gap-2">
                  <Botao variante="secundario" type="button" disabled={pagina === 0 || carregando} onClick={() => atualizarPagina(pagina - 1)}>Anterior</Botao>
                  <Botao variante="secundario" type="button" disabled={pagina + 1 >= totalPaginas || carregando} onClick={() => atualizarPagina(pagina + 1)}>Próxima</Botao>
                </div>
              </div>
            </section>
              </div>

              <aside className="sg-analiticos-aside" aria-label="Ações do relatório">
                <section className="sg-card sg-proxima-acao">
                  <div className="sg-card-body">
                    <span className="sg-proxima-acao__rotulo">Próxima ação</span>
                    <h2 className="h6 mt-2 mb-2">Consultar registros do período</h2>
                    <p className="texto-sm mb-3">Os gráficos e indicadores levam às NCs que formam cada resultado.</p>
                    <a className="sg-btn sg-btn--primario sg-proxima-acao__botao" href="#lista-ncs-relatorio">Ver lista de NCs</a>
                  </div>
                </section>

                <section className="sg-card sg-exportar-relatorio" aria-labelledby="exportar-relatorio">
                  <div className="sg-card-body">
                    <h2 id="exportar-relatorio" className="h6 mb-1">Exportar relatório</h2>
                    <p className="texto-xs texto-suave mb-3">Arquivos gerados com o mesmo período e filtros aplicados.</p>
                    <div className="sg-exportar-relatorio__acoes">
                      <Botao variante="secundario" type="button" carregando={baixando === "pdf"} disabled={carregando || Boolean(baixando)} onClick={() => gerar("pdf")}>Baixar PDF</Botao>
                      <Botao variante="secundario" type="button" carregando={baixando === "csv"} disabled={carregando || Boolean(baixando)} onClick={() => gerar("csv")}>Baixar CSV</Botao>
                    </div>
                  </div>
                </section>

                <section className="sg-card sg-filtros-aplicados" aria-labelledby="filtros-aplicados-relatorio">
                  <div className="sg-card-body">
                    <h2 id="filtros-aplicados-relatorio" className="h6 mb-3">Filtros aplicados</h2>
                    <dl>
                      <div><dt>Período</dt><dd>{aplicados.inicio} a {aplicados.fim}</dd></div>
                      <div><dt>Status</dt><dd>{STATUS_LABEL[aplicados.status] || "Todos os status"}</dd></div>
                      <div><dt>Colaborador</dt><dd>{pessoas.find((pessoa) => pessoa.id === aplicados.colaboradorId)?.nome || "Todos"}</dd></div>
                      <div><dt>Setor</dt><dd>{aplicados.setor || "Todos"}</dd></div>
                    </dl>
                    <p className="texto-xs texto-suave mb-0">Escopo: {escopo}.</p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </Container>
      {detalheIndicador && <ModalNcsIndicador titulo={detalheIndicador.titulo} filtro={detalheIndicador.filtro} retorno="/relatorios" aoFechar={() => setDetalheIndicador(null)} />}
    </div>
  );
}
