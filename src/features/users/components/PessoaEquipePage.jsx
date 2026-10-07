"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";

import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { listarEquipe, listarNcsDaPessoa } from "../client/usuarioService.js";

const STATUS = {
  aberta: "Aberta",
  aguardando_analise: "Aguardando análise",
  validada: "Aguardando feedback",
  aguardando_feedback: "Aguardando feedback",
  aguardando_aceite: "Aguardando aceite",
  concluida: "Concluída",
  invalidada: "Invalidada",
};
const DATA = (value) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export default function PessoaEquipePage() {
  const { usuarioId } = useParams();
  const [pessoa, setPessoa] = useState(null);
  const [resultado, setResultado] = useState({ items: [], total: 0, pagina: 0, por_pagina: 25 });
  const [status, setStatus] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [filtros, setFiltros] = useState({});
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

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

  function aplicarFiltros(event) {
    event.preventDefault();
    setCarregando(true);
    setPagina(0);
    setFiltros({ status, inicio, fim });
  }

  function limparFiltros() {
    setCarregando(true);
    setStatus("");
    setInicio("");
    setFim("");
    setPagina(0);
    setFiltros({});
  }

  function mudarPagina(proxima) {
    setCarregando(true);
    setPagina(proxima);
  }

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / resultado.por_pagina));

  return (
    <div>
      <Container className="sg-container">
        <Link href="/equipe" className="sg-voltar mb-3 d-inline-flex">&larr; Voltar para a equipe</Link>
        <CabecalhoPagina
          titulo={pessoa ? `NCs de ${pessoa.nome}` : "NCs do liderado"}
          subtitulo={pessoa ? `${pessoa.setor || "Setor não informado"} · histórico visível na hierarquia atual` : "Não conformidades, filtros e acesso ao histórico individual."}
          acoes={pessoa ? <Link href={`/usuarios/${pessoa.id}/dossie`} className="sg-btn sg-btn--primario">Ver indicadores e dossiê</Link> : null}
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
              <Button type="submit" variant="primary">Aplicar filtros</Button>
              <Button type="button" variant="outline-secondary" onClick={limparFiltros}>Limpar</Button>
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
                <thead><tr><th>NC</th><th>Data</th><th>Status</th><th>Criticidade</th><th>Setor</th><th>Abrir</th></tr></thead>
                <tbody>{resultado.items.map((nc) => (
                  <tr key={nc.id}>
                    <th scope="row">#{nc.id}</th>
                    <td>{DATA(nc.data || nc.criado_em)}</td>
                    <td><span className="sg-badge sg-badge--azul">{STATUS[nc.status] || nc.status}</span></td>
                    <td>{nc.criticidade || "—"}</td>
                    <td>{nc.setor || "—"}</td>
                    <td><Link className="sg-btn sg-btn--secundario sg-btn--sm" href={`/nc/${nc.id}`}>Ver detalhe</Link></td>
                  </tr>
                ))}</tbody>
              </Table>
            </div>
            <div className="d-flex justify-content-between mt-3">
              <Button variant="outline-secondary" disabled={pagina === 0} onClick={() => mudarPagina(pagina - 1)}>Anterior</Button>
              <Button variant="outline-secondary" disabled={pagina + 1 >= totalPaginas} onClick={() => mudarPagina(pagina + 1)}>Próxima</Button>
            </div>
          </>
        ) : null}
      </Container>
    </div>
  );
}
