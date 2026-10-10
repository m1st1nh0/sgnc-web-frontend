"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";

import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import Botao from "../../../components/ui/Botao.jsx";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
import BadgePrioridade from "../../../components/ui/BadgePrioridade.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { comRetorno, urlComFiltros } from "../../../lib/utils/retorno.js";
import { listarEquipe, listarNcsDaPessoa } from "../client/usuarioService.js";

const STATUS = {
  aberta: "Aberta",
  aguardando_analise: "Aguardando análise",
  validada: "Aguardando feedback",
  aguardando_feedback: "Aguardando feedback",
  aguardando_aceite: "Aguardando aceite",
  nao_respondida: "Não respondida",
  em_plano_acao: "Em plano de ação",
  concluida: "Concluída",
  invalidada: "Invalidada",
};
const DATA = (value) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export default function PessoaEquipePage() {
  const { usuarioId } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filtros e página ficam na URL: o retorno do detalhe da NC restaura o mesmo recorte.
  const filtros = useMemo(() => ({
    status: searchParams.get("status") || "",
    inicio: searchParams.get("inicio") || "",
    fim: searchParams.get("fim") || "",
  }), [searchParams]);
  const pagina = Math.max(0, Number(searchParams.get("pagina")) || 0);
  const [pessoa, setPessoa] = useState(null);
  const [resultado, setResultado] = useState({ items: [], total: 0, pagina: 0, por_pagina: 25 });
  const [status, setStatus] = useState(filtros.status);
  const [inicio, setInicio] = useState(filtros.inicio);
  const [fim, setFim] = useState(filtros.fim);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const urlAtual = urlComFiltros(pathname, { ...filtros, pagina });

  useEffect(() => {
    let ativa = true;
    Promise.all([listarEquipe(), listarNcsDaPessoa(usuarioId, { pagina, ...filtros })])
      .then(([pessoas, ncs]) => {
        if (!ativa) return;
        const encontrada = pessoas.find((item) => item.id === usuarioId);
        if (!encontrada) throw new Error("Pessoa fora do escopo ou não encontrada.");
        setPessoa(encontrada);
        setResultado(ncs);
        setErro("");
      })
      .catch((falha) => { if (ativa) setErro(falha?.message || "Não foi possível carregar as NCs da pessoa."); })
      .finally(() => { if (ativa) setCarregando(false); });
    return () => { ativa = false; };
  }, [usuarioId, pagina, filtros]);

  function navegar(proximos, proximaPagina = 0) {
    const destino = urlComFiltros(pathname, { ...proximos, pagina: proximaPagina });
    if (destino === urlAtual) return;
    setCarregando(true);
    router.replace(destino, { scroll: false });
  }

  function aplicarFiltros(event) {
    event.preventDefault();
    if (inicio && fim && inicio > fim) {
      setErro("A data inicial não pode ser posterior à data final.");
      return;
    }
    setErro("");
    navegar({ status, inicio, fim });
  }

  function limparFiltros() {
    setStatus("");
    setInicio("");
    setFim("");
    navegar({});
  }

  function mudarPagina(proxima) {
    navegar(filtros, proxima);
  }

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / resultado.por_pagina));

  return (
    <div>
      <Container className="sg-container">
        <Link href="/equipe" className="sg-voltar mb-3 d-inline-flex">&larr; Voltar para a equipe</Link>
        <CabecalhoPagina
          titulo={pessoa ? `NCs de ${pessoa.nome}` : "NCs do liderado"}
          subtitulo={pessoa ? `${pessoa.setor || "Setor não informado"} · histórico visível na hierarquia atual` : "Não conformidades, filtros e acesso ao histórico individual."}
          acoes={pessoa ? <Link href={comRetorno(`/usuarios/${pessoa.id}/dossie`, urlAtual)} className="sg-btn sg-btn--primario">Ver indicadores e dossiê</Link> : null}
        />

        {erro && <MensagemErro mensagem={erro} />}
        <Form className="sg-card mb-3" onSubmit={aplicarFiltros}>
          <div className="sg-card-body row g-3 align-items-end">
            <Form.Group className="col-sm-6 col-lg-3" controlId="filtro-status-pessoa">
              <Form.Label>Status</Form.Label>
              <Form.Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-sm-6 col-lg-3" controlId="periodo-inicio-pessoa">
              <Form.Label>Data inicial</Form.Label>
              <Form.Control type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} />
            </Form.Group>
            <Form.Group className="col-sm-6 col-lg-3" controlId="periodo-fim-pessoa">
              <Form.Label>Data final</Form.Label>
              <Form.Control type="date" value={fim} onChange={(event) => setFim(event.target.value)} />
            </Form.Group>
            <div className="col-sm-6 col-lg-3 d-flex gap-2">
              <Botao type="submit" variante="primario" disabled={carregando}>Aplicar filtros</Botao>
              <Botao type="button" variante="secundario" disabled={carregando} onClick={limparFiltros}>Limpar</Botao>
            </div>
          </div>
        </Form>

        {carregando ? <EstadoCarregamento mensagem="Carregando não conformidades..." /> : !erro && resultado.items.length === 0 ? (
          <EstadoVazio titulo="Nenhuma NC encontrada" descricao="Não há registros para esta pessoa com os filtros selecionados." />
        ) : !erro ? (
          <>
            <p className="texto-sm texto-suave">{resultado.total} NC(s) · página {pagina + 1} de {totalPaginas}</p>
            <div className="sg-tabela-wrap">
              <Table hover responsive className="align-middle">
                <thead><tr><th scope="col">NC</th><th scope="col">Data</th><th scope="col">Status</th><th scope="col">Criticidade</th><th scope="col">Setor</th><th scope="col"><span className="visually-hidden">Ação</span></th></tr></thead>
                <tbody>{resultado.items.map((nc) => (
                  <tr key={nc.id}>
                    <th scope="row">#{nc.id}</th>
                    <td>{DATA(nc.data || nc.criado_em)}</td>
                    <td><BadgeStatus status={nc.status} /></td>
                    <td><BadgePrioridade criticidade={nc.criticidade} /></td>
                    <td>{nc.setor || "—"}</td>
                    <td><Link className="sg-btn sg-btn--secundario sg-btn--sm" href={comRetorno(`/nc/${nc.id}`, urlAtual)} aria-label={`Ver detalhe da NC ${nc.id}`}>Ver detalhe</Link></td>
                  </tr>
                ))}</tbody>
              </Table>
            </div>
            {totalPaginas > 1 && <nav className="d-flex justify-content-between mt-3" aria-label="Paginação das NCs">
              <Botao variante="secundario" disabled={pagina === 0} onClick={() => mudarPagina(pagina - 1)}>Anterior</Botao>
              <Botao variante="secundario" disabled={pagina + 1 >= totalPaginas} onClick={() => mudarPagina(pagina + 1)}>Próxima</Botao>
            </nav>}
          </>
        ) : null}
      </Container>
    </div>
  );
}
