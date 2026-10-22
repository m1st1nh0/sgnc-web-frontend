"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "react-bootstrap/Container";

import { listarNcs } from "../client/ncService.js";
import { listarEquipe, listarOpcoesNc } from "../../users/client/usuarioService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { criarVisaoHome, filtrarNcsPorCardHome, ordenarNcsHome } from "../client/homeUx.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { useOnboarding } from "../../onboarding/components/OnboardingContext.jsx";
import OnboardingChecklist from "../../onboarding/components/OnboardingChecklist.jsx";
import DicaContextual from "../../onboarding/components/DicaContextual.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { acaoPendente } from "../client/statusNc.js";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
import BadgePrioridade from "../../../components/ui/BadgePrioridade.jsx";
import { formatarData } from "../../../lib/utils/formato.js";
import EtapasNc from "./EtapasNc.jsx";
import HistoricoNc from "./HistoricoNc.jsx";
import { useRascunho } from "../../../lib/utils/rascunho.js";

const STATUS_EM_ANDAMENTO = [
  "aguardando_feedback",
  "aguardando_aceite",
  "em_plano_acao",
  "validada",
  "aguardando_analise",
  "reaberta",
  "em_verificacao",
  "nao_eficaz",
  "escalada",
];

// "comigo" usa as prioridades da visão do papel (o que exige a atenção de quem está vendo).
const ABAS_FILTRO = [
  { chave: "todas", rotulo: "Todas", status: null },
  { chave: "comigo", rotulo: "Comigo", status: null },
  { chave: "aberta", rotulo: "Abertas", status: "aberta" },
  { chave: "em_andamento", rotulo: "Em andamento", status: STATUS_EM_ANDAMENTO },
  { chave: "nao_respondida", rotulo: "Não respondidas", status: "nao_respondida" },
  { chave: "encerradas", rotulo: "Encerradas", status: ["concluida", "invalidada"] },
];

// Abaixo desta largura a lista ocupa a tela toda e cada item abre a NC completa.
const MEDIA_PAINEL = "(min-width: 1100px)";

function normalizar(texto) {
  return String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export default function HomePage() {
  const { usuario } = useAuth();
  const { concluirEtapa } = useOnboarding();
  const [ncs, setNcs] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [equipeIds, setEquipeIds] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useRascunho("inicio", "abaAtiva", "todas");
  const [filtroCardAtivo, setFiltroCardAtivo] = useRascunho("inicio", "filtroCardAtivo", null);
  const [termoBusca, setTermoBusca] = useRascunho("inicio", "termoBusca", "");
  const [selecionadaId, setSelecionadaId] = useState(null);

  async function carregar() {
    try {
      setErro("");
      const precisaEquipe = usuario?.papel === "supervisor";
      const [resultadoNcs, resultadoPessoas, resultadoEquipe] =
        await Promise.allSettled([
          listarNcs(),
          listarOpcoesNc(),
          precisaEquipe ? listarEquipe() : Promise.resolve([]),
        ]);

      if (resultadoNcs.status !== "fulfilled") {
        throw resultadoNcs.reason;
      }
      if (precisaEquipe && resultadoEquipe.status !== "fulfilled") {
        throw resultadoEquipe.reason;
      }

      setNcs(resultadoNcs.value);
      setPessoas(
        resultadoPessoas.status === "fulfilled" ? resultadoPessoas.value : []
      );
      setEquipeIds(
        resultadoEquipe.status === "fulfilled"
          ? resultadoEquipe.value.map((item) => item.id)
          : []
      );
      // Onboarding é auxiliar: registra em segundo plano, sem segurar o painel.
      const quantidadeEquipe = resultadoEquipe.status === "fulfilled"
        ? resultadoEquipe.value.length
        : 0;
      void (async () => {
        await concluirEtapa("checklist_conhecer_painel", "checklist", {
          pagina: "home",
        });
        if (usuario?.papel === "supervisor") {
          await concluirEtapa("checklist_equipe", "checklist", {
            quantidade: quantidadeEquipe,
          });
        }
      })();
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível carregar as Não Conformidades."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id, usuario?.papel]);

  async function atualizar() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  const visao = useMemo(
    () => criarVisaoHome(usuario, ncs, equipeIds),
    [usuario, ncs, equipeIds]
  );
  const idsPrioritarios = useMemo(() => new Set(visao.prioridades.map((nc) => nc.id)), [visao.prioridades]);

  const ncsFiltradas = useMemo(() => {
    let resultado;
    if (filtroCardAtivo) {
      resultado = filtrarNcsPorCardHome(ncs, filtroCardAtivo, usuario?.id);
    } else if (abaAtiva === "comigo") {
      resultado = ncs.filter((nc) => idsPrioritarios.has(nc.id));
    } else {
      const filtro = ABAS_FILTRO.find((a) => a.chave === abaAtiva);
      if (!filtro || !filtro.status) resultado = ncs;
      else {
        const statusAlvo = Array.isArray(filtro.status) ? filtro.status : [filtro.status];
        resultado = ncs.filter((nc) => statusAlvo.includes(nc.status));
      }
    }
    const termo = normalizar(termoBusca.trim());
    if (termo) {
      resultado = resultado.filter((nc) => normalizar([
        nc.id, nc.colaborador, nc.setor, nc.chamado, nc.assunto, nc.descricao, nc.status,
      ].filter((valor) => valor != null).join(" ")).includes(termo));
    }
    return ordenarNcsHome(resultado, visao.prioridades);
  }, [ncs, abaAtiva, filtroCardAtivo, termoBusca, usuario?.id, visao.prioridades, idsPrioritarios]);

  const contagemPorAba = useMemo(() => {
    const contagem = {};
    for (const aba of ABAS_FILTRO) {
      if (aba.chave === "comigo") {
        contagem[aba.chave] = ncs.filter((nc) => idsPrioritarios.has(nc.id)).length;
        continue;
      }
      if (!aba.status) {
        contagem[aba.chave] = ncs.length;
        continue;
      }
      const statusAlvo = Array.isArray(aba.status) ? aba.status : [aba.status];
      contagem[aba.chave] = ncs.filter((nc) => statusAlvo.includes(nc.status)).length;
    }
    return contagem;
  }, [ncs, idsPrioritarios]);

  function obterNomeAbertoPor(nc) {
    if (!nc.aberto_por) return null;
    if (nc.aberto_por === usuario?.id) return usuario.nome;
    const pessoa = pessoas.find((item) => item.id === nc.aberto_por);
    return pessoa?.nome || "Usuário não disponível";
  }

  function filtrarPeloCard(rotulo) {
    setAbaAtiva("todas");
    setFiltroCardAtivo((atual) => atual === rotulo ? null : rotulo);
    requestAnimationFrame(() => {
      document.getElementById("lista-ncs-home")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function selecionarNaLista(evento, nc) {
    // Em telas largas o item abre no painel ao lado; nas estreitas o link segue para a NC completa.
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
    if (!window.matchMedia(MEDIA_PAINEL).matches) return;
    evento.preventDefault();
    setSelecionadaId(nc.id);
  }

  const ncsPrioritarias = ncsFiltradas.filter((nc) => idsPrioritarios.has(nc.id));
  const demaisNcs = ncsFiltradas.filter((nc) => !idsPrioritarios.has(nc.id));
  const grupos = [
    { titulo: "Exigem sua atenção", registros: ncsPrioritarias, destaque: true },
    { titulo: ncsPrioritarias.length ? "Demais registros" : "Registros", registros: demaisNcs },
  ].filter((grupo) => grupo.registros.length > 0);
  const selecionada = ncsFiltradas.find((nc) => nc.id === selecionadaId) ?? ncsFiltradas[0] ?? null;
  const rotuloFiltro = filtroCardAtivo || ABAS_FILTRO.find((aba) => aba.chave === abaAtiva)?.rotulo;
  const destaque = visao.destaque;

  return (
    <Container className="sg-container sg-gestao">
      <OnboardingChecklist />
      {usuario?.papel === "supervisor" && <DicaContextual chave="dica_equipe_direta" className="mb-4" />}
      {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

      <header className="sg-pagina-cabecalho">
        <div className="sg-pagina-cabecalho__texto">
          <h1>{visao.titulo}</h1>
          <p>{visao.subtitulo}</p>
        </div>
        <div className="sg-pagina-cabecalho__acoes">
          <button type="button" className="sg-btn sg-btn--secundario" onClick={atualizar} disabled={atualizando || carregando}>
            {atualizando ? "Atualizando..." : "Atualizar"}
          </button>
          <Link href="/abrir-nc" className="sg-btn sg-btn--sucesso">+ Abrir NC</Link>
        </div>
      </header>

      {carregando ? <EstadoCarregamento mensagem="Carregando não conformidades..." /> : <>
        <section className="sg-proxima-faixa" aria-labelledby="proxima-acao-titulo">
          <span className="sg-proxima-faixa__rotulo">Próxima ação</span>
          <p className="sg-proxima-faixa__texto">
            <strong id="proxima-acao-titulo">{destaque.titulo}.</strong> <span>{destaque.descricao}</span>
          </p>
          {destaque.acao.filtro
            ? <button type="button" className="sg-proxima-faixa__botao" aria-controls="lista-ncs-home" aria-pressed={filtroCardAtivo === destaque.acao.filtro}
                onClick={() => { if (filtroCardAtivo !== destaque.acao.filtro) filtrarPeloCard(destaque.acao.filtro); }}>{destaque.acao.rotulo}</button>
            : <Link href={destaque.acao.destino} className="sg-proxima-faixa__botao">{destaque.acao.rotulo}</Link>}
        </section>

        <nav className="sg-etapas-barra" aria-label="Etapas: filtre a lista pela etapa">
          {visao.cards.map((card, index) => (
            <button key={card.rotulo} type="button" className={`sg-etapas-barra__item sg-etapas-barra__item--${card.cor}`}
              onClick={() => filtrarPeloCard(card.rotulo)} aria-pressed={filtroCardAtivo === card.rotulo}
              aria-controls="lista-ncs-home" title={card.descricao}>
              <span className="sg-etapas-barra__rotulo">{index + 1} · {card.rotulo}</span>
              <span className="sg-etapas-barra__valor">{card.valor}</span>
              <span className="visually-hidden">{filtroCardAtivo === card.rotulo ? "Filtro ativo, clique para limpar" : `Filtrar: ${card.descricao}`}</span>
            </button>
          ))}
        </nav>

        <div className="sg-gestao__area">
          <section id="lista-ncs-home" className="sg-gestao__lista sg-ancora-secao" aria-labelledby="lista-ncs-home-titulo">
            <h2 id="lista-ncs-home-titulo" className="visually-hidden">{visao.tituloLista}</h2>
            <div className="sg-gestao__ferramentas">
              <label className="sg-campo-rotulo" htmlFor="buscar-nc-home">Buscar
                <input id="buscar-nc-home" className="sg-input form-control" type="search"
                  placeholder="NC, pessoa ou chamado" value={termoBusca} onChange={(event) => setTermoBusca(event.target.value)} />
              </label>
              <div className="sg-filtros-pilula" role="group" aria-label="Filtrar não conformidades por situação">
                {ABAS_FILTRO.map((aba) => {
                  const ativa = !filtroCardAtivo && abaAtiva === aba.chave;
                  return <button key={aba.chave} type="button" className="sg-pilula" aria-pressed={ativa} aria-controls="lista-ncs-home"
                    onClick={() => { setFiltroCardAtivo(null); setAbaAtiva(aba.chave); }}>
                    {aba.rotulo} <span>{contagemPorAba[aba.chave] ?? 0}</span>
                  </button>;
                })}
              </div>
              <div className="sg-gestao__resumo-filtro">
                <span role="status" aria-live="polite">{ncsFiltradas.length} registro(s) · {rotuloFiltro}</span>
                {(filtroCardAtivo || termoBusca || abaAtiva !== "todas") && <button type="button" className="sg-link-botao"
                  onClick={() => { setFiltroCardAtivo(null); setTermoBusca(""); setAbaAtiva("todas"); }}>Limpar filtros</button>}
              </div>
            </div>
            {ncsFiltradas.length === 0
              ? <EstadoVazio titulo="Nenhuma Não Conformidade encontrada" descricao="Revise a busca ou limpe os filtros para ver outros registros." />
              : grupos.map((grupo) => <div key={grupo.titulo} className="sg-gestao__grupo">
                <h3 className={`sg-gestao__grupo-titulo${grupo.destaque ? " sg-gestao__grupo-titulo--destaque" : ""}`}>{grupo.titulo} · {grupo.registros.length}</h3>
                <ul className="sg-gestao__itens">
                  {grupo.registros.map((nc) => {
                    const pendente = acaoPendente(nc, usuario?.id);
                    const atual = selecionada?.id === nc.id;
                    return <li key={nc.id}>
                      <Link href={`/nc/${nc.id}`} className={`sg-gestao__item${atual ? " is-selecionada" : ""}`}
                        aria-current={atual ? "true" : undefined} onClick={(evento) => selecionarNaLista(evento, nc)}>
                        <span className="sg-gestao__item-topo">
                          <span className="sg-mono">#{nc.id} · {formatarData(nc.data)}</span>
                          <BadgeStatus status={nc.status} />
                        </span>
                        <span className="sg-gestao__item-nome">{nc.colaborador || "Colaborador não informado"}</span>
                        <span className="sg-gestao__item-meta">
                          {[nc.setor, nc.chamado && `Chamado ${nc.chamado}`, nc.criticidade && `prioridade ${String(nc.criticidade).toLocaleLowerCase("pt-BR")}`].filter(Boolean).join(" · ")}
                        </span>
                        <span className="sg-gestao__item-meta">Aberta por <strong>{nc.aberto_por === usuario?.id ? "você" : obterNomeAbertoPor(nc) || "—"}</strong></span>
                        {pendente && <span className="sg-gestao__item-com">Com quem está: <strong>{pendente.responsavel}</strong></span>}
                      </Link>
                    </li>;
                  })}
                </ul>
              </div>)}
          </section>

          {selecionada && <PainelNcGestao key={selecionada.id} nc={selecionada} usuario={usuario} abertoPor={obterNomeAbertoPor(selecionada)} />}
        </div>
      </>}
    </Container>
  );
}

/** Resumo da NC selecionada na lista: dados da ocorrência, etapas e linha do tempo, com link para a NC completa. */
function PainelNcGestao({ nc, usuario, abertoPor }) {
  return (
    <article className="sg-gestao__painel" aria-labelledby={`painel-nc-${nc.id}`}>
      <header className="sg-gestao__painel-cabecalho">
        <div className="sg-gestao__painel-titulo">
          <span className="sg-mono">NC #{nc.id}{nc.chamado ? ` · Chamado ${nc.chamado}` : ""}</span>
          <h2 id={`painel-nc-${nc.id}`}>{nc.colaborador || "Colaborador não informado"}</h2>
          <span className="sg-texto-apoio">
            {[nc.setor, abertoPor && `aberta por ${abertoPor} em ${formatarData(nc.data)}`].filter(Boolean).join(" · ")}
          </span>
          <span className="sg-gestao__painel-selos">
            <BadgeStatus status={nc.status} />
            <BadgePrioridade criticidade={nc.criticidade} />
            {nc.critica && <span className="sg-badge sg-badge--vermelho">NC crítica</span>}
          </span>
        </div>
        <Link href={`/nc/${nc.id}`} className="sg-btn sg-btn--primario">Ver NC completa</Link>
      </header>
      <div className="sg-gestao__painel-etapas">
        <EtapasNc nc={nc} visualizadorId={usuario?.id} compacta />
      </div>
      <div className="sg-gestao__painel-corpo">
        <section className="sg-gestao__painel-dados" aria-labelledby={`ocorrencia-nc-${nc.id}`}>
          <h3 id={`ocorrencia-nc-${nc.id}`} className="sg-secao-titulo">Ocorrência</h3>
          {nc.descricao && <p className="sg-gestao__painel-descricao">{nc.descricao}</p>}
          <dl className="sg-dados">
            <div><dt>Data</dt><dd>{formatarData(nc.data)}</dd></div>
            <div><dt>Causas</dt><dd>{nc.causas?.length ? nc.causas.join(", ") : "—"}</dd></div>
            <div><dt>Reincidência</dt><dd>{nc.reincidencia ?? "—"}</dd></div>
            <div><dt>Crítica</dt><dd>{nc.critica ? "Sim" : "Não"}</dd></div>
          </dl>
        </section>
        <div className="sg-gestao__painel-historico">
          <HistoricoNc ncId={nc.id} versao={`${nc.status}-${nc.atualizado_em ?? ""}`} compacta />
        </div>
      </div>
    </article>
  );
}
