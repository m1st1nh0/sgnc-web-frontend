"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";

import { buscarNcsDoIndicador } from "../client/insightsService.js";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
import Botao from "../../../components/ui/Botao.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { comRetorno } from "../../../lib/utils/retorno.js";

const DATA = (value) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export default function ModalNcsIndicador({ filtro, titulo, aoFechar, retorno = "/" }) {
  const [resultado, setResultado] = useState({ items: [], total: 0 });
  const [pagina, setPagina] = useState(0);
  // Começa carregando para não exibir "nenhuma NC" antes da primeira resposta.
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    buscarNcsDoIndicador(filtro, pagina)
      .then((dados) => { if (ativo) { setErro(""); setResultado(dados); } })
      .catch((e) => { if (ativo) setErro(e?.message || "Não foi possível carregar as NCs."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [filtro, pagina]);

  function mudarPagina(proxima) {
    setCarregando(true);
    setPagina(proxima);
  }

  const totalPaginas = Math.max(1, Math.ceil((resultado.total || 0) / (resultado.por_pagina || 25)));
  return (
    <Modal show centered size="lg" scrollable onHide={aoFechar} aria-labelledby="modal-ncs-indicador">
      <Modal.Header closeButton closeLabel="Fechar lista de NCs">
        <Modal.Title id="modal-ncs-indicador" className="h5">{titulo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="texto-sm texto-suave" aria-live="polite">
          {carregando ? "Buscando NCs deste indicador…" : `${resultado.total ?? 0} NC(s) neste indicador. Selecione uma NC para abrir o detalhe.`}
        </p>
        <MensagemErro mensagem={erro} />
        {carregando ? (
          <EstadoCarregamento mensagem="Carregando NCs..." compacto />
        ) : resultado.items?.length ? (
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead><tr><th scope="col">NC</th><th scope="col">Data</th><th scope="col">Colaborador</th><th scope="col">Status</th><th scope="col">Setor</th><th scope="col"><span className="visually-hidden">Ação</span></th></tr></thead>
              <tbody>{resultado.items.map((nc) => (
                <tr key={nc.id}>
                  <th scope="row">#{nc.id}</th>
                  <td>{DATA(nc.data || nc.criado_em)}</td>
                  <td>{nc.colaborador || "—"}</td>
                  <td><BadgeStatus status={nc.status} /></td>
                  <td>{nc.setor || "—"}</td>
                  <td><Link className="sg-btn sg-btn--secundario sg-btn--sm" href={comRetorno(`/nc/${nc.id}`, retorno)} aria-label={`Abrir NC ${nc.id}`}>Abrir</Link></td>
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
          <Botao variante="secundario" tamanho="sm" disabled={pagina === 0 || carregando} onClick={() => mudarPagina(pagina - 1)}>Anterior</Botao>
          <Botao variante="secundario" tamanho="sm" disabled={pagina + 1 >= totalPaginas || carregando} onClick={() => mudarPagina(pagina + 1)}>Próxima</Botao>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
