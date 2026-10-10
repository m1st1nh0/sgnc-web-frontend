"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
import { acaoPendente } from "../client/statusNc.js";
import BadgePrioridade from "../../../components/ui/BadgePrioridade.jsx";
import { listarMinhasNcs } from "../client/ncService.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import { comRetorno } from "../../../lib/utils/retorno.js";
import { infoDoStatus } from "../client/statusNc.js";

// Filtra por etapa: status legados equivalentes aparecem uma única vez.
const STATUS = ["aberta", "aguardando_feedback", "aguardando_aceite", "em_plano_acao", "concluida", "invalidada", "validada"]
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

  const minhasNcs = useMemo(() => {
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

  return (
    <div>
      <Container className="sg-container">
        <CabecalhoPagina titulo="Minhas NCs" subtitulo="Acompanhe ocorrências abertas por você ou associadas ao seu nome, com status e próximos passos." />
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        <div className="sg-card mb-4">
          <div className="sg-card-body p-3 d-flex flex-wrap gap-3 align-items-end">
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
            <Form.Group className="flex-grow-1" style={{ minWidth: "220px" }} controlId="minhas-ncs-busca">
              <Form.Label className="sg-label">Buscar</Form.Label>
              <Form.Control className="sg-input" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Descrição, chamado ou número" />
            </Form.Group>
            <span className="texto-secundario texto-sm" aria-live="polite">{minhasNcs.length} NC(s)</span>
          </div>
        </div>
        {carregando ? <EstadoCarregamento mensagem="Carregando suas NCs..." /> : minhasNcs.length === 0 ? (
          <>
            <EstadoVazio titulo="Nenhuma NC encontrada" descricao="Ajuste os filtros ou abra uma nova não conformidade." />
            <div className="text-center"><Link className="sg-btn sg-btn--primario" href="/abrir-nc">Abrir NC</Link></div>
          </>
        ) : (
          <div className="d-flex flex-column gap-3">
            {minhasNcs.map((nc) => (
              <Link key={nc.id} href={comRetorno(`/nc/${nc.id}`, "/minhas-ncs")} className="sg-card sg-card--link text-decoration-none">
                <div className="sg-card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div className="flex-grow-1">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <strong>NC #{nc.id}</strong><BadgePrioridade criticidade={nc.criticidade} /><BadgeStatus status={nc.status} />
                    </div>
                    <div className="texto-secundario">{nc.descricao || "Sem descrição"}</div>
                    <div className="texto-xs texto-suave mt-1">{nc.colaborador || usuario?.nome} · {formatarData(nc)}{nc.chamado ? ` · Chamado ${nc.chamado}` : ""}</div>
                    {acaoPendente(nc, usuario?.id) && <div className="texto-xs mt-1"><strong>Aguardando:</strong> {acaoPendente(nc, usuario?.id).responsavel}</div>}
                  </div>
                  <span className="sg-voltar" aria-hidden="true">Ver detalhes →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
