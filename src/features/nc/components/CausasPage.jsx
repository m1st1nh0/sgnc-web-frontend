"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import CabecalhoPagina from "@/components/ui/CabecalhoPagina.jsx";
import EstadoCarregamento from "@/components/ui/EstadoCarregamento.jsx";
import {
  atualizarCausaCatalogo,
  criarCausaCatalogo,
  definirCausaAtiva,
  excluirCausaCatalogo,
  decidirSolicitacaoCausa,
  listarCausasGestao,
  listarSolicitacoesCausa,
} from "@/features/nc/client/ncService.js";

function mensagemErro(error) {
  return error?.message || "Não foi possível carregar a governança de causas.";
}

export default function CausasPage() {
  const [dados, setDados] = useState({ solicitacoes: [], causas: [] });
  const [catalogo, setCatalogo] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [solicitacaoEmDecisao, setSolicitacaoEmDecisao] = useState(null);
  const [causasExistentes, setCausasExistentes] = useState({});
  const [motivosRejeicao, setMotivosRejeicao] = useState({});
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [novaCausa, setNovaCausa] = useState("");
  const [causaEditando, setCausaEditando] = useState(null);
  const [descricaoEditando, setDescricaoEditando] = useState("");
  const [salvandoCatalogo, setSalvandoCatalogo] = useState(false);
  const [causaEmAtualizacao, setCausaEmAtualizacao] = useState(null);
  const [causaParaExcluir, setCausaParaExcluir] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [solicitacoes, causas] = await Promise.all([listarSolicitacoesCausa(), listarCausasGestao()]);
      setDados(solicitacoes);
      setCatalogo(causas);
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

  async function salvarCausa(event) {
    event.preventDefault();
    const descricao = causaEditando ? descricaoEditando : novaCausa;
    if (salvandoCatalogo || !descricao.trim()) return;
    setSalvandoCatalogo(true);
    setErro("");
    setAviso("");
    try {
      if (causaEditando) {
        await atualizarCausaCatalogo(causaEditando, descricao);
        setAviso("Causa atualizada. Os registros históricos continuam vinculados.");
        setCausaEditando(null);
        setDescricaoEditando("");
      } else {
        await criarCausaCatalogo(descricao);
        setAviso("Causa cadastrada no catálogo.");
        setNovaCausa("");
      }
      await carregar();
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setSalvandoCatalogo(false);
    }
  }

  async function alternarSituacao(causa) {
    setCausaEmAtualizacao(causa.id);
    setErro("");
    setAviso("");
    try {
      await definirCausaAtiva(causa.id, !causa.ativo);
      setAviso(causa.ativo
        ? `“${causa.descricao}” foi arquivada. O histórico das NCs foi preservado.`
        : `“${causa.descricao}” voltou ao catálogo ativo.`);
      await carregar();
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setCausaEmAtualizacao(null);
    }
  }

  async function excluirCausa() {
    if (!causaParaExcluir || causaEmAtualizacao) return;
    setCausaEmAtualizacao(causaParaExcluir.id);
    setErro("");
    setAviso("");
    try {
      await excluirCausaCatalogo(causaParaExcluir.id);
      setAviso(`“${causaParaExcluir.descricao}” foi excluída do catálogo.`);
      setCausaParaExcluir(null);
      await carregar();
    } catch (error) {
      setErro(mensagemErro(error));
      setCausaParaExcluir(null);
    } finally {
      setCausaEmAtualizacao(null);
    }
  }

  return (
    <div>
      <Container className="sg-container sg-governanca">
        <div className="sg-governanca__intro">
          <span className="sg-governanca__eyebrow">QUALIDADE · CATÁLOGO</span>
          <CabecalhoPagina
            titulo="Governança de causas"
            subtitulo="Revise as sugestões da equipe e mantenha o catálogo consistente."
          />
        </div>

        {erro && <Alert variant="danger" className="sg-governanca__feedback" role="alert" dismissible onClose={() => setErro("")}>{erro}</Alert>}
        {aviso && <Alert variant="success" className="sg-governanca__feedback" role="status" dismissible onClose={() => setAviso("")}>{aviso}</Alert>}

        <section className="sg-card sg-governanca__panel" aria-labelledby="causas-pendentes-titulo">
          <header className="sg-governanca__panel-head">
            <div className="sg-governanca__section-mark sg-governanca__section-mark--pending" aria-hidden="true">↗</div>
            <div className="sg-governanca__panel-title">
              <div className="sg-governanca__title-line">
                <h2 id="causas-pendentes-titulo">Solicitações pendentes</h2>
                <span className="sg-governanca__count" aria-label={`${dados.solicitacoes.length} solicitações pendentes`}>{dados.solicitacoes.length}</span>
              </div>
              <p>Aprove uma nova causa ou associe a uma já existente. Rejeições exigem justificativa.</p>
            </div>
            <Button type="button" className="sg-governanca__refresh" variant="outline-secondary" onClick={carregar} disabled={carregando}>
              <span aria-hidden="true">↻</span>{carregando ? "Atualizando…" : "Atualizar fila"}
            </Button>
          </header>

          {carregando ? (
            <div className="sg-governanca__empty sg-governanca__empty--loading"><EstadoCarregamento mensagem="Carregando solicitações..." /></div>
          ) : dados.solicitacoes.length === 0 ? (
            <div className="sg-governanca__empty">
              <span className="sg-governanca__empty-icon" aria-hidden="true">✓</span>
              <div>
                <h3>Fila em dia</h3>
                <p>Quando a equipe sugerir uma causa, ela aparecerá aqui para análise.</p>
              </div>
            </div>
          ) : (
            <div className="sg-governanca__requests">
              {dados.solicitacoes.map((solicitacao) => (
                <article className="sg-governanca__request" key={solicitacao.id} aria-labelledby={`solicitacao-causa-${solicitacao.id}`}>
                  <div className="sg-governanca__request-heading">
                    <div>
                      <span className="sg-governanca__request-label">Causa sugerida</span>
                      <h3 id={`solicitacao-causa-${solicitacao.id}`}>{solicitacao.descricao}</h3>
                    </div>
                    <time dateTime={solicitacao.solicitado_em} className="sg-governanca__date">
                      {new Date(solicitacao.solicitado_em).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </div>
                  <div className="sg-governanca__request-meta"><span>Solicitada por</span><strong>{solicitacao.solicitante_nome}</strong></div>
                  <div className="sg-governanca__reason"><span>Justificativa</span><p>{solicitacao.justificativa}</p></div>

                  <div className="sg-governanca__decision-grid">
                    <Form.Group>
                    <Form.Label htmlFor={`associar-causa-${solicitacao.id}`}>Destino da aprovação</Form.Label>
                    <Form.Select
                      id={`associar-causa-${solicitacao.id}`}
                      value={causasExistentes[solicitacao.id] || ""}
                      onChange={(event) => setCausasExistentes((atual) => ({ ...atual, [solicitacao.id]: event.target.value }))}
                    >
                      <option value="">Criar nova ou localizar equivalente automaticamente</option>
                      {dados.causas.map((causa) => <option key={causa.id} value={causa.id}>{causa.descricao}</option>)}
                    </Form.Select>
                    </Form.Group>

                    <Form.Group>
                    <Form.Label htmlFor={`motivo-causa-${solicitacao.id}`}>Motivo da rejeição <span>(obrigatório ao rejeitar)</span></Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={1}
                      id={`motivo-causa-${solicitacao.id}`}
                      value={motivosRejeicao[solicitacao.id] || ""}
                      onChange={(event) => setMotivosRejeicao((atual) => ({ ...atual, [solicitacao.id]: event.target.value }))}
                    />
                    </Form.Group>
                  </div>

                  <footer className="sg-governanca__request-actions">
                    <span>A decisão será registrada no histórico.</span>
                    <div>
                    <Button type="button" variant="outline-danger" onClick={() => decidir(solicitacao, "rejeitar")} disabled={Boolean(solicitacaoEmDecisao)}>
                      Rejeitar
                    </Button>
                    <Button type="button" className="sg-governanca__approve" onClick={() => decidir(solicitacao, "aprovar")} disabled={Boolean(solicitacaoEmDecisao)}>
                      {solicitacaoEmDecisao === solicitacao.id ? "Salvando..." : "Aprovar / associar"}
                    </Button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="sg-card sg-governanca__panel sg-governanca__catalog" aria-labelledby="causas-ativas-titulo">
          <header className="sg-governanca__panel-head">
            <div className="sg-governanca__section-mark sg-governanca__section-mark--catalog" aria-hidden="true">✓</div>
            <div className="sg-governanca__panel-title">
              <div className="sg-governanca__title-line">
                <h2 id="causas-ativas-titulo">Catálogo de causas</h2>
                <span className="sg-governanca__catalog-count">{catalogo.filter((causa) => causa.ativo).length} ativas</span>
              </div>
              <p>Crie e edite opções. Causas sem vínculos podem ser excluídas; as que possuem NCs são arquivadas para preservar o histórico.</p>
            </div>
          </header>
          <Form className="sg-governanca__create-cause" onSubmit={salvarCausa}>
            <Form.Group className="flex-grow-1">
              <Form.Label htmlFor="nova-causa-catalogo">Nova causa</Form.Label>
              <Form.Control id="nova-causa-catalogo" value={novaCausa} maxLength={120} onChange={(event) => setNovaCausa(event.target.value)} placeholder="Ex.: Falha no retorno ao cliente" disabled={salvandoCatalogo || Boolean(causaEditando)} />
            </Form.Group>
            <Button type="submit" disabled={salvandoCatalogo || !novaCausa.trim() || Boolean(causaEditando)}>{salvandoCatalogo && !causaEditando ? "Salvando…" : "Adicionar causa"}</Button>
          </Form>
          {catalogo.length ? (
            <ul className="sg-governanca__catalog-list">
              {catalogo.map((causa) => (
                <li key={causa.id} className={!causa.ativo ? "is-archived" : ""}>
                  {causaEditando === causa.id ? (
                    <Form className="sg-governanca__cause-edit" onSubmit={salvarCausa}>
                      <Form.Control aria-label={`Editar descrição de ${causa.descricao}`} value={descricaoEditando} maxLength={120} onChange={(event) => setDescricaoEditando(event.target.value)} autoFocus />
                      <Button type="submit" size="sm" disabled={salvandoCatalogo || !descricaoEditando.trim()}>{salvandoCatalogo ? "Salvando…" : "Salvar"}</Button>
                      <Button type="button" size="sm" variant="outline-secondary" onClick={() => { setCausaEditando(null); setDescricaoEditando(""); }}>Cancelar</Button>
                    </Form>
                  ) : (
                    <>
                      <span className="sg-governanca__cause-status" aria-hidden="true">{causa.ativo ? "✓" : "—"}</span>
                      <span className="sg-governanca__cause-copy"><strong>{causa.descricao}</strong><small>{causa.ativo ? "Ativa" : "Arquivada"} · {causa.ncs_vinculadas} NC(s) vinculada(s)</small></span>
                      <div className="sg-governanca__cause-actions">
                        <Button type="button" size="sm" variant="outline-secondary" onClick={() => { setCausaEditando(causa.id); setDescricaoEditando(causa.descricao); setNovaCausa(""); }} disabled={causaEmAtualizacao === causa.id}>Editar</Button>
                        {!causa.ativo && <Button type="button" size="sm" variant="outline-success" onClick={() => alternarSituacao(causa)} disabled={causaEmAtualizacao === causa.id}>Restaurar</Button>}
                        {causa.ativo && causa.ncs_vinculadas > 0 && <Button type="button" size="sm" variant="outline-danger" onClick={() => alternarSituacao(causa)} disabled={causaEmAtualizacao === causa.id}>Arquivar</Button>}
                        {causa.ncs_vinculadas === 0 && <Button type="button" size="sm" variant="outline-danger" onClick={() => setCausaParaExcluir(causa)} disabled={causaEmAtualizacao === causa.id}>Excluir</Button>}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="sg-governanca__catalog-empty">Ainda não há causas cadastradas. Use o campo acima ou aprove uma solicitação da equipe.</div>
          )}
        </section>
      </Container>
      <Modal show={Boolean(causaParaExcluir)} centered onHide={() => setCausaParaExcluir(null)} aria-labelledby="confirmar-exclusao-causa">
        <Modal.Header closeButton><Modal.Title id="confirmar-exclusao-causa">Excluir causa?</Modal.Title></Modal.Header>
        <Modal.Body>A causa “{causaParaExcluir?.descricao}” não possui NCs vinculadas e será removida do catálogo.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setCausaParaExcluir(null)} disabled={Boolean(causaEmAtualizacao)}>Cancelar</Button>
          <Button variant="danger" onClick={excluirCausa} disabled={Boolean(causaEmAtualizacao)}>{causaEmAtualizacao ? "Excluindo…" : "Excluir causa"}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
