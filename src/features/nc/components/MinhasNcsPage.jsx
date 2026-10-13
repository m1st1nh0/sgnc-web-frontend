"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
import { acaoPendente, etapasDaNc } from "../client/statusNc.js";
import { listarMinhasNcs } from "../client/ncService.js";
import { listarOpcoesNc } from "../../users/client/usuarioService.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import { comRetorno } from "../../../lib/utils/retorno.js";
import { infoDoStatus } from "../client/statusNc.js";

// Filtra por etapa: status legados equivalentes aparecem uma única vez.
const STATUS = ["aberta", "aguardando_feedback", "aguardando_aceite", "nao_respondida", "em_plano_acao", "concluida", "invalidada", "validada"]
  .map((status) => ({ valor: infoDoStatus(status).etapa, rotulo: infoDoStatus(status).rotulo }));
const PERIODOS = [
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "90", rotulo: "Últimos 90 dias" },
  { valor: "365", rotulo: "Últimos 12 meses" },
  { valor: "todos", rotulo: "Todo o período" },
];

function dataDoRegistro(nc) {
  const valor = nc.criado_em || nc.data;
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function formatarData(nc) {
  const data = dataDoRegistro(nc);
  return data ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(data) : "—";
}

export default function MinhasNcsPage() {
  const { usuario } = useAuth();
  const [ncs, setNcs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState("todos");
  const [periodo, setPeriodo] = useState("30");
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("abertas");
  const [pessoas, setPessoas] = useState([]);

  useEffect(() => {
    // Nome de quem abriu cada NC; sem a lista, os cartões seguem sem o nome.
    let ativo = true;
    listarOpcoesNc().then((lista) => { if (ativo) setPessoas(lista); }).catch(() => {});
    return () => { ativo = false; };
  }, []);
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setAgora(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let ativo = true;
    listarMinhasNcs()
      .then((resultado) => { if (ativo) setNcs(resultado); })
      .catch((e) => { if (ativo) setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar suas NCs."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const filtradas = useMemo(() => {
    const limite = periodo === "todos" || !agora ? null : agora - Number(periodo) * 86400000;
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return ncs.filter((nc) => {
      if (nc.colaborador_id !== usuario?.id && nc.aberto_por !== usuario?.id) return false;
      if (status !== "todos" && infoDoStatus(nc.status).etapa !== status) return false;
      const data = dataDoRegistro(nc);
      if (limite && data && data.getTime() < limite) return false;
      if (termo && !`${nc.id} ${nc.descricao || ""} ${nc.chamado || ""}`.toLocaleLowerCase("pt-BR").includes(termo)) return false;
      return true;
    });
  }, [ncs, usuario?.id, status, periodo, busca, agora]);
  const abertasPorMim = filtradas.filter((nc) => nc.aberto_por === usuario?.id);
  const sobreMim = filtradas.filter((nc) => nc.colaborador_id === usuario?.id);
  const minhasNcs = origem === "sobre" ? sobreMim : abertasPorMim;
  const ABAS = [
    { chave: "abertas", rotulo: "Abertas por mim", total: abertasPorMim.length },
    { chave: "sobre", rotulo: "Sobre mim", total: sobreMim.length },
  ];

  return (
    <div>
      <Container className="sg-container sg-minhas">
        <header className="sg-pagina-cabecalho">
          <div className="sg-pagina-cabecalho__texto">
            <h1>Minhas NCs</h1>
            <p>NCs abertas por você ou sobre você, com a etapa atual e com quem cada uma está.</p>
          </div>
          <div className="sg-pagina-cabecalho__acoes">
            <Link className="sg-btn sg-btn--sucesso" href="/abrir-nc">+ Abrir NC</Link>
          </div>
        </header>
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        <div className="sg-cartao sg-minhas__ferramentas">
          <div className="sg-abas" role="group" aria-label="Origem das NCs">
            {ABAS.map((aba) => (
              <button key={aba.chave} type="button" className="sg-abas__item" aria-pressed={origem === aba.chave} onClick={() => setOrigem(aba.chave)}>
                {aba.rotulo} <span>{aba.total}</span>
              </button>
            ))}
          </div>
          <div className="sg-minhas__filtros">
            <Form.Group controlId="minhas-ncs-status">
              <Form.Label className="sg-label">Status</Form.Label>
              <Form.Select className="sg-input" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="todos">Todos os status</option>
                {STATUS.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="minhas-ncs-periodo">
              <Form.Label className="sg-label">Período</Form.Label>
              <Form.Select className="sg-input" value={periodo} onChange={(event) => setPeriodo(event.target.value)}>
                {PERIODOS.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="sg-minhas__busca" controlId="minhas-ncs-busca">
              <Form.Label className="sg-label">Buscar</Form.Label>
              <Form.Control className="sg-input" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Descrição, chamado ou número" />
            </Form.Group>
          </div>
          <span className="sg-texto-apoio" aria-live="polite">{minhasNcs.length} NC(s)</span>
        </div>
        {carregando ? <EstadoCarregamento mensagem="Carregando suas NCs..." /> : minhasNcs.length === 0 ? (
          <EstadoVazio titulo="Nenhuma NC encontrada" descricao={origem === "sobre" ? "Não há NCs sobre você com estes filtros." : "Ajuste os filtros ou abra uma nova não conformidade."} />
        ) : (
          <ul className="sg-minhas__lista">
            {minhasNcs.map((nc) => {
              const pendente = acaoPendente(nc, usuario?.id);
              const etapas = etapasDaNc(nc, usuario?.id);
              const indiceAtual = etapas.findIndex((etapa) => ["atual", "atrasada", "encerrada"].includes(etapa.situacao));
              const posicao = indiceAtual >= 0 ? indiceAtual + 1 : etapas.length;
              return (
                <li key={nc.id}>
                  <Link href={comRetorno(`/nc/${nc.id}`, "/minhas-ncs")} className="sg-cartao sg-minhas__nc">
                    <span className="sg-minhas__topo">
                      <span className="sg-mono">#{nc.id} · {formatarData(nc)}</span>
                      <BadgeStatus status={nc.status} />
                    </span>
                    <span className="sg-minhas__quem">
                      <strong>{nc.colaborador || usuario?.nome}</strong>
                      <span className="sg-texto-apoio">{[nc.setor, nc.chamado && `Chamado ${nc.chamado}`, nc.criticidade && `prioridade ${String(nc.criticidade).toLocaleLowerCase("pt-BR")}`].filter(Boolean).join(" · ")}</span>
                    </span>
                    {(nc.aberto_por === usuario?.id || pessoas.length > 0) && <span className="sg-texto-apoio">Aberta por <strong>{nc.aberto_por === usuario?.id ? "você" : pessoas.find((pessoa) => pessoa.id === nc.aberto_por)?.nome || "usuário inativo"}</strong></span>}
                    {nc.descricao && <span className="sg-minhas__descricao">{nc.descricao}</span>}
                    <span className="sg-minhas__trilha" role="img" aria-label={`Etapa ${posicao} de ${etapas.length}`}>
                      {etapas.map((etapa) => <span key={etapa.chave} className={`sg-minhas__trilha-passo sg-minhas__trilha-passo--${etapa.situacao}`} />)}
                    </span>
                    <span className="sg-minhas__rodape">
                      <span>{pendente ? <>Com quem está: <strong>{pendente.responsavel}</strong></> : "Sem ação pendente"}</span>
                      <span className="sg-minhas__ver" aria-hidden="true">Ver detalhes →</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </div>
  );
}
