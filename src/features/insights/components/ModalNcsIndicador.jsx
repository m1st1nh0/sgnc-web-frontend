"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";

import { buscarNcsDoIndicador } from "../client/insightsService.js";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";

const STATUS = {
  aberta: "Aguardando avaliação",
  aguardando_analise: "Aguardando avaliação",
  validada: "Aguardando feedback",
  aguardando_feedback: "Aguardando feedback",
  aguardando_aceite: "Aguardando aceite",
  concluida: "Concluída",
  invalidada: "Invalidada",
};
const DATA = (value) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export default function ModalNcsIndicador({ filtro, titulo, aoFechar }) {
  const [resultado, setResultado] = useState({ items: [], total: 0 });
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    buscarNcsDoIndicador(filtro, pagina)
      .then((dados) => { if (ativo) { setErro(""); setResultado(dados); } })
      .catch((e) => { if (ativo) setErro(e?.message || "Não foi possível carregar as NCs."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [filtro, pagina]);

  const totalPaginas = Math.max(1, Math.ceil((resultado.total || 0) / (resultado.por_pagina || 25)));
  return (
    <Modal show centered size="lg" onHide={aoFechar} aria-labelledby="modal-ncs-indicador">
      <Modal.Header closeButton>
        <Modal.Title id="modal-ncs-indicador" className="h5">{titulo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="texto-sm texto-suave">{resultado.total ?? 0} NC(s) neste indicador. Selecione uma NC para abrir o detalhe.</p>
        {erro && <Alert variant="danger" role="alert">{erro}</Alert>}
        {carregando ? (
          <div className="d-flex justify-content-center p-4" role="status" aria-label="Carregando NCs">
            <Spinner animation="border" size="sm" />
          </div>
        ) : resultado.items?.length ? (
          <div className="table-responsive">
            <Table hover responsive="sm" className="align-middle mb-0">
              <thead><tr><th scope="col">NC</th><th scope="col">Data</th><th scope="col">Colaborador</th><th scope="col">Status</th><th scope="col">Setor</th><th scope="col"><span className="visually-hidden">Ação</span></th></tr></thead>
              <tbody>{resultado.items.map((nc) => (
                <tr key={nc.id}>
                  <th scope="row">#{nc.id}</th>
                  <td>{DATA(nc.data || nc.criado_em)}</td>
                  <td>{nc.colaborador || "—"}</td>
                  <td>{STATUS[nc.status] || nc.status}</td>
                  <td>{nc.setor || "—"}</td>
                  <td><Button as={Link} href={`/nc/${nc.id}`} size="sm" variant="outline-primary">Abrir</Button></td>
                </tr>
              ))}</tbody>
            </Table>
          </div>
        ) : !erro ? (
          <EstadoVazio titulo="Nenhuma NC encontrada" descricao="Não há registros visíveis para este indicador e período." />
        ) : null}
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <span className="texto-sm texto-suave">Página {pagina + 1} de {totalPaginas}</span>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" disabled={pagina === 0 || carregando} onClick={() => { setCarregando(true); setPagina((atual) => atual - 1); }}>Anterior</Button>
          <Button variant="outline-secondary" disabled={pagina + 1 >= totalPaginas || carregando} onClick={() => { setCarregando(true); setPagina((atual) => atual + 1); }}>Próxima</Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
