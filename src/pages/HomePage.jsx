import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";

import BarraNavegacao from "../components/BarraNavegacao";
import { listarNcs } from "../services/ncService";
import { listarUsuarios } from "../services/usuarioService";
import { ErroApi } from "../services/api";
import { formatarData } from "../utils/formato";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import EstadoVazio from "../components/ui/EstadoVazio";
import MensagemErro from "../components/ui/MensagemErro";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import CardMetrica from "../components/ui/CardMetrica";
import NcCard from "../components/ui/NcCard";
import BadgeStatus from "../components/ui/BadgeStatus";

const ABAS_FILTRO = [
  { chave: "todas", rotulo: "Todas", status: null },
  { chave: "aberta", rotulo: "Abertas", status: "aberta" },
  {
    chave: "em_andamento",
    rotulo: "Em andamento",
    status: ["validada", "aguardando_analise", "aguardando_aceite"],
  },
  { chave: "concluida", rotulo: "Concluídas", status: "concluida" },
  { chave: "invalidada", rotulo: "Invalidadas", status: "invalidada" },
];

const STATUS_PENDENTE = ["aberta", "validada", "aguardando_analise"];
const STATUS_RESOLVIDA = "concluida";

export default function HomePage() {
  const navigate = useNavigate();

  const [ncs, setNcs] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("todas");

  useEffect(() => {
    async function carregar() {
      try {
        // Usa allSettled: a lista de usuários é auxiliar (resolve nomes de
        // "aberto_por"). Se falhar, o dashboard continua funcionando com "-".
        const [resultadoNcs, resultadoUsuarios] = await Promise.allSettled([
          listarNcs(),
          listarUsuarios(),
        ]);

        if (resultadoNcs.status === "fulfilled") {
          setNcs(resultadoNcs.value);
        } else {
          throw resultadoNcs.reason;
        }

        if (resultadoUsuarios.status === "fulfilled") {
          setUsuarios(resultadoUsuarios.value);
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
    carregar();
  }, []);

  const ncsFiltradas = useMemo(() => {
    const filtro = ABAS_FILTRO.find((a) => a.chave === abaAtiva);
    if (!filtro || !filtro.status) return ncs;

    const statusAlvo = Array.isArray(filtro.status)
      ? filtro.status
      : [filtro.status];
    return ncs.filter((nc) => statusAlvo.includes(nc.status));
  }, [ncs, abaAtiva]);

  // Contagem por aba (para exibir nos filtros)
  const contagemPorAba = useMemo(() => {
    const contagem = {};
    for (const aba of ABAS_FILTRO) {
      if (!aba.status) {
        contagem[aba.chave] = ncs.length;
        continue;
      }
      const statusAlvo = Array.isArray(aba.status) ? aba.status : [aba.status];
      contagem[aba.chave] = ncs.filter((nc) =>
        statusAlvo.includes(nc.status)
      ).length;
    }
    return contagem;
  }, [ncs]);

  // Indicadores reais
  const totalNcs = ncs.length;
  const ncsAbertas = ncs.filter((nc) => nc.status === "aberta").length;
  const ncsPendentes = ncs.filter((nc) =>
    STATUS_PENDENTE.includes(nc.status)
  ).length;
  const ncsResolvidas = ncs.filter((nc) => nc.status === STATUS_RESOLVIDA).length;

  // Atividades recentes
  const ncsRecentes = useMemo(() => {
    const comData = ncs.filter((nc) => nc.data);
    return [...comData]
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
      .slice(0, 5);
  }, [ncs]);

  function obterNomeAbertoPor(nc) {
    if (!nc.aberto_por) return "-";
    const usuario = usuarios.find((u) => u.id === nc.aberto_por);
    return usuario?.nome || nc.aberto_por || "-";
  }

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container">
        <CabecalhoPagina
          titulo="Dashboard"
          subtitulo="Visão geral das Não Conformidades"
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
            {/* Métricas do dashboard usando dados reais */}
            <div className="row g-3 mb-4">
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Total de NCs"
                  valor={totalNcs}
                  descricao="Não conformidades registradas"
                  cor="azul"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Abertas"
                  valor={ncsAbertas}
                  descricao="Aguardando avaliação"
                  cor="amarela"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Pendentes"
                  valor={ncsPendentes}
                  descricao="Em fluxo de análise"
                  cor="laranja"
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <CardMetrica
                  rotulo="Resolvidas"
                  valor={ncsResolvidas}
                  descricao="Concluídas"
                  cor="verde"
                />
              </div>
            </div>

            {/* Ações rápidas */}
            <div className="sg-acoes-rapidas mb-5">
              <Link to="/abrir-nc" className="sg-acao-rapida sg-acao-rapida--principal">
                <span className="sg-acao-rapida__icone" aria-hidden="true">+</span>
                Abrir Não Conformidade
              </Link>
              <Link to="/" className="sg-acao-rapida">
                <span className="sg-acao-rapida__icone" aria-hidden="true">↻</span>
                Ver todas as NCs
              </Link>
            </div>

            {/* Atividades recentes */}
            <h2 className="h5 mb-3">Atividades recentes</h2>
            {ncsRecentes.length === 0 ? (
              <EstadoVazio
                titulo="Sem atividades recentes"
                descricao="As últimas não conformidades aparecerão aqui."
              />
            ) : (
              <div className="sg-card mb-5 overflow-hidden">
                <div className="d-flex flex-column">
                  {ncsRecentes.map((nc, indice) => (
                    <Link
                      key={nc.id}
                      to={`/nc/${nc.id}`}
                      className="d-flex align-items-center justify-content-between gap-3 px-4 py-3 text-decoration-none"
                      style={{
                        borderBottom:
                          indice < ncsRecentes.length - 1 ? "1px solid var(--borda)" : "none",
                      }}
                    >
                      <div className="d-flex align-items-center gap-3 min-w-0">
                        <span className="sg-nc-card__numero">NC #{nc.id}</span>
                        <div className="min-w-0">
                          <div className="fw-semibold text-truncate">
                            {nc.colaborador || "-"}
                          </div>
                          <div className="texto-xs texto-suave">
                            {formatarData(nc.data)} · {nc.criticidade || "-"}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <BadgeStatus status={nc.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <h2 className="h5 mb-3">Lista completa</h2>

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
                descricao="Não há registros para este filtro. Abra uma nova não conformidade para começar."
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