"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import BarraNavegacao from "@/components/navigation/BarraNavegacao.jsx";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina.jsx";
import EstadoCarregamento from "@/components/ui/EstadoCarregamento.jsx";
import {
  decidirSolicitacaoCausa,
  listarSolicitacoesCausa,
} from "@/features/nc/client/ncService.js";

function mensagemErro(error) {
  return error?.message || "Não foi possível carregar a governança de causas.";
}

export default function CausasPage() {
  const [dados, setDados] = useState({ solicitacoes: [], causas: [] });
  const [carregando, setCarregando] = useState(true);
  const [solicitacaoEmDecisao, setSolicitacaoEmDecisao] = useState(null);
  const [causasExistentes, setCausasExistentes] = useState({});
  const [motivosRejeicao, setMotivosRejeicao] = useState({});
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      setDados(await listarSolicitacoesCausa());
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(carregar);
  }, [carregar]);

  async function decidir(solicitacao, decisao) {
    setErro("");
    setAviso("");
    setSolicitacaoEmDecisao(solicitacao.id);
    try {
      await decidirSolicitacaoCausa(solicitacao.id, {
        decisao,
        causa_existente_id: decisao === "aprovar" ? causasExistentes[solicitacao.id] || null : null,
        observacao: motivosRejeicao[solicitacao.id] || null,
      });
      setAviso(decisao === "aprovar" ? "Solicitação aprovada e registrada no catálogo." : "Solicitação rejeitada com justificativa.");
      setMotivosRejeicao((atual) => ({ ...atual, [solicitacao.id]: "" }));
      setCausasExistentes((atual) => ({ ...atual, [solicitacao.id]: "" }));
      await carregar();
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setSolicitacaoEmDecisao(null);
    }
  }

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container">
        <CabecalhoPagina
          titulo="Governança de causas"
          subtitulo="Revise solicitações e mantenha o catálogo consistente."
        />

        {erro && <Alert variant="danger" role="alert">{erro}</Alert>}
        {aviso && <Alert variant="success" role="status">{aviso}</Alert>}

        <section className="sg-card mb-4" aria-labelledby="causas-pendentes-titulo">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <h2 id="causas-pendentes-titulo" className="sg-secao-form__titulo">Solicitações pendentes</h2>
              <p className="sg-secao-form__descricao">A aprovação cria uma causa nova ou associa a uma existente. Rejeições exigem motivo.</p>
            </div>
            <Button type="button" variant="outline-secondary" size="sm" onClick={carregar} disabled={carregando}>Atualizar fila</Button>
          </div>

          {carregando ? (
            <EstadoCarregamento mensagem="Carregando solicitações..." />
          ) : dados.solicitacoes.length === 0 ? (
            <div className="text-muted py-3">Não há solicitações pendentes.</div>
          ) : (
            <div className="d-grid gap-3">
              {dados.solicitacoes.map((solicitacao) => (
                <article className="border rounded p-3" key={solicitacao.id} aria-labelledby={`solicitacao-causa-${solicitacao.id}`}>
                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <h3 id={`solicitacao-causa-${solicitacao.id}`} className="h5 mb-1">{solicitacao.descricao}</h3>
                    <small className="text-muted">{new Date(solicitacao.solicitado_em).toLocaleString("pt-BR")}</small>
                  </div>
                  <p className="mb-1"><strong>Solicitante:</strong> {solicitacao.solicitante_nome}</p>
                  <p className="mb-3"><strong>Justificativa:</strong> {solicitacao.justificativa}</p>

                  <Form.Group className="mb-2">
                    <Form.Label htmlFor={`associar-causa-${solicitacao.id}`}>Aprovar como nova ou associar a uma causa existente</Form.Label>
                    <Form.Select
                      id={`associar-causa-${solicitacao.id}`}
                      value={causasExistentes[solicitacao.id] || ""}
                      onChange={(event) => setCausasExistentes((atual) => ({ ...atual, [solicitacao.id]: event.target.value }))}
                    >
                      <option value="">Criar nova ou localizar equivalente automaticamente</option>
                      {dados.causas.map((causa) => <option key={causa.id} value={causa.id}>{causa.descricao}</option>)}
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label htmlFor={`motivo-causa-${solicitacao.id}`}>Motivo da rejeição (obrigatório para rejeitar)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      id={`motivo-causa-${solicitacao.id}`}
                      value={motivosRejeicao[solicitacao.id] || ""}
                      onChange={(event) => setMotivosRejeicao((atual) => ({ ...atual, [solicitacao.id]: event.target.value }))}
                    />
                  </Form.Group>

                  <div className="d-flex flex-wrap gap-2">
                    <Button type="button" onClick={() => decidir(solicitacao, "aprovar")} disabled={solicitacaoEmDecisao === solicitacao.id}>
                      {solicitacaoEmDecisao === solicitacao.id ? "Salvando..." : "Aprovar / associar"}
                    </Button>
                    <Button type="button" variant="outline-danger" onClick={() => decidir(solicitacao, "rejeitar")} disabled={solicitacaoEmDecisao === solicitacao.id}>
                      Rejeitar
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="sg-card" aria-labelledby="causas-ativas-titulo">
          <h2 id="causas-ativas-titulo" className="sg-secao-form__titulo">Catálogo ativo</h2>
          <p className="sg-secao-form__descricao">Causas disponíveis no formulário de abertura e edição de NC.</p>
          <ul className="mb-0">
            {dados.causas.map((causa) => <li key={causa.id}>{causa.descricao}</li>)}
          </ul>
        </section>
      </Container>
    </div>
  );
}
