import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";

import BarraNavegacao from "../components/BarraNavegacao";
import { listarNcs } from "../services/ncService";
import { listarOpcoesNc, listarUsuarios } from "../services/usuarioService";
import { ErroApi } from "../services/api";
import { criarVisaoHome } from "../services/homeUx";
import { useAuth } from "../context/AuthContext";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import EstadoVazio from "../components/ui/EstadoVazio";
import MensagemErro from "../components/ui/MensagemErro";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import CardMetrica from "../components/ui/CardMetrica";
import NcCard from "../components/ui/NcCard";

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
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [ncs, setNcs] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [equipeIds, setEquipeIds] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("todas");

  async function carregar() {
    try {
      setErro("");
      const precisaEquipe = usuario?.papel === "supervisor";
      const [resultadoNcs, resultadoPessoas, resultadoEquipe] =
        await Promise.allSettled([
          listarNcs(),
          listarOpcoesNc(),
          precisaEquipe ? listarUsuarios() : Promise.resolve([]),
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
    const filtro = ABAS_FILTRO.find((a) => a.chave === abaAtiva);
    if (!filtro || !filtro.status) return ncs;
    const statusAlvo = Array.isArray(filtro.status)
      ? filtro.status
      : [filtro.status];
    return ncs.filter((nc) => statusAlvo.includes(nc.status));
  }, [ncs, abaAtiva]);

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


  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container">
        <CabecalhoPagina
          titulo={visao.titulo}
          subtitulo={visao.subtitulo}
          acoes={
            <Link to="/abrir-nc" className="sg-btn sg-btn--primario">
              + Abrir NC
            </Link>
          }
        />

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
                  <Link to={visao.destaque.acao.destino} className="sg-btn sg-btn--claro">
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
                  <CardMetrica
                    rotulo={card.rotulo}
                    valor={card.valor}
                    descricao={card.descricao}
                    cor={card.cor}
                  />
                </div>
              ))}
            </div>

            <section className="mb-5" aria-labelledby="atalhos-do-papel">
              <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
                <div>
                  <h2 id="atalhos-do-papel" className="h5 mb-1">Acessos importantes para você</h2>
                  <p className="texto-sm texto-suave mb-0">Atalhos organizados conforme seu papel no sistema.</p>
                </div>
              </div>
              <div className="sg-atalhos-papel">
                {visao.atalhos.map((atalho) => (
                  <Link to={atalho.destino} className="sg-atalho-papel" key={atalho.rotulo}>
                    <span className="sg-atalho-papel__icone" aria-hidden="true">{atalho.icone}</span>
                    <span><strong>{atalho.rotulo}</strong><small>{atalho.descricao}</small></span>
                    <span className="sg-atalho-papel__seta" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>

            <h2 id="prioridades" className="h5 mb-3 sg-ancora-secao">{visao.tituloPrioridades}</h2>
            {visao.prioridades.length === 0 ? (
              <EstadoVazio
                titulo="Tudo em dia"
                descricao={visao.vazioPrioridades}
              />
            ) : (
              <div className="d-flex flex-column gap-3 mb-5">
                {visao.prioridades.map((nc) => (
                  <NcCard
                    key={nc.id}
                    nc={nc}
                    abertoPorNome={obterNomeAbertoPor(nc)}
                    aoClicar={() => navigate(`/nc/${nc.id}`)}
                  />
                ))}
              </div>
            )}

            <h2 className="h5 mb-3">{visao.tituloLista}</h2>
            <Nav
              variant="tabs"
              activeKey={abaAtiva}
              onSelect={setAbaAtiva}
              className="mb-3"
            >
              {ABAS_FILTRO.map((aba) => (
                <Nav.Item key={aba.chave}>
                  <Nav.Link eventKey={aba.chave}>
                    {aba.rotulo}
                    <span className="texto-xs texto-suave ms-1">
                      ({contagemPorAba[aba.chave] ?? 0})
                    </span>
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>

            {ncsFiltradas.length === 0 ? (
              <EstadoVazio
                titulo="Nenhuma Não Conformidade encontrada"
                descricao="Não há registros para este filtro."
              />
            ) : (
              <div className="d-flex flex-column gap-3">
                {ncsFiltradas.map((nc) => (
                  <NcCard
                    key={nc.id}
                    nc={nc}
                    abertoPorNome={obterNomeAbertoPor(nc)}
                    aoClicar={() => navigate(`/nc/${nc.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  );
}
