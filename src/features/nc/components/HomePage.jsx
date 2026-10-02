"use client";

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

const STATUS_EM_ANDAMENTO = [
  "aguardando_feedback",
  "aguardando_aceite",
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


  return (
    <div>
      <Container className="sg-container">
        <CabecalhoPagina
          titulo={visao.titulo}
          subtitulo={visao.subtitulo}
          acoes={
            <Link href="/abrir-nc" className="sg-btn sg-btn--primario">
              + Abrir NC
            </Link>
          }
        />

        <OnboardingChecklist />
        {usuario?.papel === "supervisor" && (
          <DicaContextual chave="dica_equipe_direta" className="mb-4" />
        )}

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {carregando ? (
          <EstadoCarregamento mensagem="Carregando não conformidades..." />
        ) : (
          <>
            <section className={`sg-home-destaque sg-home-destaque--${usuario?.papel || "funcionario"} mb-4`}>
              <div className="sg-home-destaque__conteudo">
                <span className="sg-home-destaque__rotulo">{visao.destaque.rotulo}</span>
                <h2>{visao.destaque.titulo}</h2>
                <p>{visao.destaque.descricao}</p>
                {visao.destaque.acao.destino.startsWith("#") ? (
                  <a href={visao.destaque.acao.destino} className="sg-btn sg-btn--claro">
                    {visao.destaque.acao.rotulo}
                  </a>
                ) : (
                  <Link href={visao.destaque.acao.destino} className="sg-btn sg-btn--claro">
                    {visao.destaque.acao.rotulo}
                  </Link>
                )}
              </div>
              <button
                type="button"
                className="sg-home-atualizar"
                onClick={atualizar}
                disabled={atualizando}
              >
                <span aria-hidden="true">↻</span>
                {atualizando ? "Atualizando..." : "Atualizar dados"}
              </button>
            </section>

            <div className="row g-3 mb-4">
              {visao.cards.map((card) => (
                <div className="col-sm-6 col-lg-3" key={card.rotulo}>
                  <button
                    type="button"
                    className="sg-metrica-interativa"
                    onClick={() => filtrarPeloCard(card.rotulo)}
                    aria-pressed={filtroCardAtivo === card.rotulo}
                    aria-label={`Filtrar lista de NCs: ${card.rotulo}, ${card.valor}`}
                  >
                    <CardMetrica
                      rotulo={card.rotulo}
                      valor={card.valor}
                      descricao={card.descricao}
                      cor={card.cor}
                    />
                    <span className="sg-metrica-interativa__acao">
                      {filtroCardAtivo === card.rotulo ? "Filtro ativo · clique para limpar" : "Filtrar lista de NCs"}
                    </span>
                  </button>
                </div>
              ))}
            </div>

            <section id="lista-ncs-home" className="sg-ancora-secao" aria-labelledby="lista-ncs-home-titulo">
              <div className="sg-home-fila__heading">
                <div>
                  <span className="sg-home-fila__eyebrow">{visao.tituloPrioridades}</span>
                  <h2 id="lista-ncs-home-titulo" className="h5 mb-1">{visao.tituloLista}</h2>
                  <p className="texto-sm texto-suave mb-0">As NCs que pedem ação aparecem primeiro; cada registro é mostrado uma única vez.</p>
                </div>
                {filtroCardAtivo && <button type="button" className="btn btn-link p-0" onClick={() => setFiltroCardAtivo(null)}>Limpar filtro: {filtroCardAtivo}</button>}
              </div>
              {filtroCardAtivo && <p className="texto-sm texto-suave mt-2" role="status">Lista filtrada pelo indicador “{filtroCardAtivo}”. Selecione o card novamente ou limpe o filtro para ver todas as NCs.</p>}
              <div className="sg-home-fila__controles">
                <Nav
                  variant="tabs"
                  activeKey={abaAtiva}
                  onSelect={(chave) => { if (chave) { setFiltroCardAtivo(null); setAbaAtiva(chave); } }}
                  aria-label="Filtrar não conformidades por status"
                >
                  {ABAS_FILTRO.map((aba) => (
                    <Nav.Item key={aba.chave}>
                      <Nav.Link eventKey={aba.chave}>
                        {aba.rotulo}<span className="texto-xs texto-suave ms-1">({contagemPorAba[aba.chave] ?? 0})</span>
                      </Nav.Link>
                    </Nav.Item>
                  ))}
                </Nav>
                <div className="sg-home-fila__busca">
                  <label htmlFor="buscar-nc-home" className="visually-hidden">Buscar não conformidade</label>
                  <input
                    id="buscar-nc-home"
                    className="form-control form-control-sm"
                    type="search"
                    placeholder="Buscar NC, pessoa ou chamado"
                    value={termoBusca}
                    onChange={(event) => setTermoBusca(event.target.value)}
                  />
                  <span className="texto-xs texto-suave" role="status" aria-live="polite">{ncsFiltradas.length} resultado(s)</span>
                </div>
              </div>

              {ncsFiltradas.length === 0 ? (
                <EstadoVazio titulo="Nenhuma Não Conformidade encontrada" descricao={termoBusca ? "Revise a busca ou limpe os filtros para ver outros registros." : "Não há registros para este filtro."} />
              ) : (
                <div className="sg-home-fila__grupos">
                  {ncsPrioritarias.length > 0 && (
                    <section aria-label="NCs prioritárias">
                      <h3 className="sg-home-fila__grupo-titulo">Exigem atenção <span>{ncsPrioritarias.length}</span></h3>
                      <div className="d-flex flex-column gap-2">
                        {ncsPrioritarias.map((nc) => <NcCard key={nc.id} nc={nc} abertoPorNome={obterNomeAbertoPor(nc)} aoClicar={() => router.push(`/nc/${nc.id}`)} />)}
                      </div>
                    </section>
                  )}
                  {demaisNcs.length > 0 && (
                    <section aria-label="Demais não conformidades">
                      <h3 className="sg-home-fila__grupo-titulo">{ncsPrioritarias.length ? "Demais registros" : "Registros"} <span>{demaisNcs.length}</span></h3>
                      <div className="d-flex flex-column gap-2">
                        {demaisNcs.map((nc) => <NcCard key={nc.id} nc={nc} abertoPorNome={obterNomeAbertoPor(nc)} aoClicar={() => router.push(`/nc/${nc.id}`)} />)}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </section>

            <section className="sg-home-atalhos-final" aria-labelledby="atalhos-do-papel">
              <div className="mb-3">
                <h2 id="atalhos-do-papel" className="h5 mb-1">Acessos importantes para você</h2>
                <p className="texto-sm texto-suave mb-0">Atalhos organizados conforme seu papel no sistema.</p>
              </div>
              <div className="sg-atalhos-papel">
                {visao.atalhos.map((atalho) => (
                  <Link href={atalho.destino} className="sg-atalho-papel" key={atalho.rotulo}>
                    <span className="sg-atalho-papel__icone" aria-hidden="true">{atalho.icone}</span>
                    <span><strong>{atalho.rotulo}</strong><small>{atalho.descricao}</small></span>
                    <span className="sg-atalho-papel__seta" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </Container>
    </div>
  );
}
