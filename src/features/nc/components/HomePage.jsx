"use client";

import "./dashboard.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";

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
import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import CardMetrica from "../../../components/ui/CardMetrica.jsx";
import NcCard from "../../../components/ui/NcCard.jsx";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
import BadgePrioridade from "../../../components/ui/BadgePrioridade.jsx";
import { formatarData } from "../../../lib/utils/formato.js";

const STATUS_EM_ANDAMENTO = [
  "aguardando_feedback",
  "aguardando_aceite",
  "em_plano_acao",
  "validada",
  "aguardando_analise",
];

const ABAS_FILTRO = [
  { chave: "todas", rotulo: "Todas", status: null },
  { chave: "aberta", rotulo: "Abertas", status: "aberta" },
  { chave: "em_andamento", rotulo: "Em andamento", status: STATUS_EM_ANDAMENTO },
  { chave: "concluida", rotulo: "Concluídas", status: "concluida" },
  { chave: "invalidada", rotulo: "Invalidadas", status: "invalidada" },
];

export default function HomePage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const { concluirEtapa } = useOnboarding();
  const [ncs, setNcs] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [equipeIds, setEquipeIds] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("todas");
  const [filtroCardAtivo, setFiltroCardAtivo] = useState(null);
  const [termoBusca, setTermoBusca] = useState("");

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
      await concluirEtapa("checklist_conhecer_painel", "checklist", {
        pagina: "home",
      });
      if (usuario?.papel === "supervisor") {
        await concluirEtapa("checklist_equipe", "checklist", {
          quantidade: resultadoEquipe.status === "fulfilled"
            ? resultadoEquipe.value.length
            : 0,
        });
      }
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

  const ncsFiltradas = useMemo(() => {
    let resultado;
    if (filtroCardAtivo) {
      resultado = filtrarNcsPorCardHome(ncs, filtroCardAtivo, usuario?.id);
    } else {
      const filtro = ABAS_FILTRO.find((a) => a.chave === abaAtiva);
      if (!filtro || !filtro.status) resultado = ncs;
      else {
        const statusAlvo = Array.isArray(filtro.status) ? filtro.status : [filtro.status];
        resultado = ncs.filter((nc) => statusAlvo.includes(nc.status));
      }
    }
    const termo = termoBusca.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    if (termo) {
      resultado = resultado.filter((nc) => [
        nc.id, nc.colaborador, nc.setor, nc.chamado, nc.assunto, nc.descricao, nc.status,
      ].filter((valor) => valor != null).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(termo));
    }
    return ordenarNcsHome(resultado, visao.prioridades);
  }, [ncs, abaAtiva, filtroCardAtivo, termoBusca, usuario?.id, visao.prioridades]);

  const contagemPorAba = useMemo(() => {
    const contagem = {};
    for (const aba of ABAS_FILTRO) {
      if (!aba.status) {
        contagem[aba.chave] = ncs.length;
        continue;
      }
      const statusAlvo = Array.isArray(aba.status)
        ? aba.status
        : [aba.status];
      contagem[aba.chave] = ncs.filter((nc) =>
        statusAlvo.includes(nc.status)
      ).length;
    }
    return contagem;
  }, [ncs]);

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

  const idsPrioritarios = new Set(visao.prioridades.map((nc) => nc.id));
  const ncsPrioritarias = ncsFiltradas.filter((nc) => idsPrioritarios.has(nc.id));
  const demaisNcs = ncsFiltradas.filter((nc) => !idsPrioritarios.has(nc.id));


  const grupos = [
    { titulo: "Exigem atenção", registros: ncsPrioritarias },
    { titulo: ncsPrioritarias.length ? "Demais registros" : "Registros", registros: demaisNcs },
  ].filter((grupo) => grupo.registros.length > 0);

  return (
    <Container className="sg-container sg-dashboard">
      <OnboardingChecklist />
      {usuario?.papel === "supervisor" && <DicaContextual chave="dica_equipe_direta" className="mb-4" />}
      {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
      <div className="sg-dashboard__layout">
        <div className="sg-dashboard__main">
          <CabecalhoPagina
            titulo={visao.titulo}
            subtitulo={visao.subtitulo}
            acoes={<Link href="/abrir-nc" className="sg-btn sg-btn--sucesso">+ Abrir NC</Link>}
          />
          {carregando ? <EstadoCarregamento mensagem="Carregando não conformidades..." /> : <>
            <section className="sg-dashboard__metrics" aria-label="Indicadores e filtros da fila">
              {visao.cards.map((card, index) => (
                <button key={card.rotulo} type="button" className="sg-metrica-interativa"
                  onClick={() => filtrarPeloCard(card.rotulo)} aria-pressed={filtroCardAtivo === card.rotulo}
                  aria-controls="lista-ncs-home" aria-label={`Filtrar lista de NCs: ${card.rotulo}, ${card.valor}`}>
                  <CardMetrica rotulo={`${index + 1} · ${card.rotulo}`} valor={card.valor} descricao={card.descricao} cor={card.cor} />
                  <span className="sg-dashboard__metric-state">{filtroCardAtivo === card.rotulo ? "Filtro ativo · limpar" : "Filtrar registros"}</span>
                </button>
              ))}
            </section>
            <section id="lista-ncs-home" className="sg-dashboard__queue sg-ancora-secao" aria-labelledby="lista-ncs-home-titulo">
              <h2 id="lista-ncs-home-titulo" className="visually-hidden">{visao.tituloLista}</h2>
              <div className="sg-dashboard__controls">
                <Nav variant="tabs" activeKey={filtroCardAtivo ? null : abaAtiva}
                  onSelect={(chave) => { if (chave) { setFiltroCardAtivo(null); setAbaAtiva(chave); } }}
                  aria-label="Filtrar não conformidades por status">
                  {ABAS_FILTRO.map((aba) => <Nav.Item key={aba.chave}>
                    <Nav.Link eventKey={aba.chave}>{aba.rotulo} <span>{contagemPorAba[aba.chave] ?? 0}</span></Nav.Link>
                  </Nav.Item>)}
                </Nav>
                <div className="sg-dashboard__search">
                  <label htmlFor="buscar-nc-home" className="visually-hidden">Buscar não conformidade</label>
                  <input id="buscar-nc-home" className="form-control form-control-sm" type="search"
                    placeholder="Buscar NC, pessoa ou chamado" value={termoBusca} onChange={(event) => setTermoBusca(event.target.value)} />
                </div>
              </div>
              <div className="sg-dashboard__filter-summary">
                <span role="status" aria-live="polite">{ncsFiltradas.length} registro(s) · {filtroCardAtivo || ABAS_FILTRO.find((aba) => aba.chave === abaAtiva)?.rotulo}</span>
                {(filtroCardAtivo || termoBusca || abaAtiva !== "todas") && <button type="button" className="sg-btn sg-btn--subtle sg-btn--sm"
                  onClick={() => { setFiltroCardAtivo(null); setTermoBusca(""); setAbaAtiva("todas"); }}>Limpar filtros</button>}
              </div>
              {ncsFiltradas.length === 0 ? <EstadoVazio titulo="Nenhuma Não Conformidade encontrada" descricao="Revise a busca ou limpe os filtros para ver outros registros." /> : <>
                <div className="sg-dashboard__table">
                  <table>
                    <caption className="visually-hidden">{visao.tituloLista}. Abra uma NC pelo seu número ou pelo nome da pessoa.</caption>
                    <colgroup><col className="sg-dashboard__col-id" /><col className="sg-dashboard__col-person" /><col /><col /><col className="sg-dashboard__col-date" /><col className="sg-dashboard__col-priority" /><col className="sg-dashboard__col-status" /></colgroup>
                    <thead><tr>{["NC", "Pessoa", "Setor", "Aberto por", "Data", "Prioridade", "Status"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
                    {grupos.map((grupo) => <tbody key={grupo.titulo}>
                      <tr className="sg-dashboard__group"><th colSpan={7} scope="rowgroup">{grupo.titulo} · {grupo.registros.length}</th></tr>
                      {grupo.registros.map((nc) => <tr key={nc.id}>
                        <td><Link href={`/nc/${nc.id}`} aria-label={`Abrir NC ${nc.id}`}>#{nc.id}</Link></td>
                        <td><Link href={`/nc/${nc.id}`}>{nc.colaborador || "Colaborador não informado"}</Link>{nc.chamado && <small>Chamado {nc.chamado}</small>}</td>
                        <td>{nc.setor || "—"}</td><td>{obterNomeAbertoPor(nc) || "—"}</td>
                        <td><time dateTime={nc.data || undefined}>{formatarData(nc.data)}</time></td>
                        <td><BadgePrioridade criticidade={nc.criticidade} /></td><td><BadgeStatus status={nc.status} /></td>
                      </tr>)}
                    </tbody>)}
                  </table>
                </div>
                <div className="sg-dashboard__cards">
                  {grupos.map((grupo) => <section key={grupo.titulo} aria-label={grupo.titulo}>
                    <h3 className="sg-home-fila__grupo-titulo">{grupo.titulo} <span>{grupo.registros.length}</span></h3>
                    <div className="d-flex flex-column gap-2">{grupo.registros.map((nc) => <NcCard key={nc.id} nc={nc} abertoPorNome={obterNomeAbertoPor(nc)} aoClicar={() => router.push(`/nc/${nc.id}`)} />)}</div>
                  </section>)}
                </div>
              </>}
            </section>
          </>}
        </div>
        {!carregando && <aside className="sg-dashboard__aside" aria-label="Próxima ação e atalhos">
          <section className="sg-dashboard__next" aria-labelledby="proxima-acao-titulo">
            <span className="sg-dashboard__eyebrow">Próxima ação</span>
            <h2 id="proxima-acao-titulo">{visao.destaque.titulo}</h2>
            <p>{visao.destaque.descricao}</p>
            {visao.destaque.acao.filtro
              ? <button type="button" className="sg-btn sg-btn--secundario" aria-controls="lista-ncs-home"
                  onClick={() => { if (filtroCardAtivo !== visao.destaque.acao.filtro) filtrarPeloCard(visao.destaque.acao.filtro); }}>{visao.destaque.acao.rotulo}</button>
              : <Link href={visao.destaque.acao.destino} className="sg-btn sg-btn--secundario">{visao.destaque.acao.rotulo}</Link>}
          </section>
          <section className="sg-dashboard__shortcuts" aria-labelledby="atalhos-do-papel">
            <h2 id="atalhos-do-papel" className="sg-dashboard__eyebrow">Atalhos</h2>
            <div className="sg-dashboard__shortcut-list">{visao.atalhos.map((atalho) => <Link href={atalho.destino} className="sg-dashboard__shortcut" key={atalho.rotulo}>
              <strong>{atalho.rotulo}</strong><small>{atalho.descricao}</small>
            </Link>)}</div>
          </section>
          <button type="button" className="sg-btn sg-btn--subtle sg-dashboard__refresh" onClick={atualizar} disabled={atualizando}>
            {atualizando ? "Atualizando..." : "↻ Atualizar dados"}
          </button>
        </aside>}
      </div>
    </Container>
  );
}
