import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import BarraNavegacao from "../components/BarraNavegacao";
import PainelAvaliar from "../components/PainelAvaliar";
import PainelFeedback from "../components/PainelFeedback";
import PainelAceite from "../components/PainelAceite";
import {
  buscarNc,
  listarEvidencias,
  anexarEvidencia,
  excluirEvidencia,
} from "../services/ncService";
import { useAuth } from "../context/AuthContext";
import { ErroApi, chamarApi } from "../services/api";
import { baixarPdfNc } from "../services/relatoriosService";
import { salvarArquivoLocal } from "../utils/arquivoLocal";
import { formatarData, formatarDataHora } from "../utils/formato";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import Botao from "../components/ui/Botao";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import EstadoVazio from "../components/ui/EstadoVazio";
import MensagemErro from "../components/ui/MensagemErro";
import ModalVisualizarEvidencia from "../components/ui/ModalVisualizarEvidencia";
import BadgeStatus from "../components/ui/BadgeStatus";
import BadgePrioridade from "../components/ui/BadgePrioridade";

const EXTENSOES_IMAGEM = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "ico",
  "tif",
  "tiff",
  "heic",
  "heif",
]);

function ehImagem(nomeArquivo) {
  if (!nomeArquivo) return false;
  const extensao = nomeArquivo.split(".").pop()?.toLowerCase() || "";
  return EXTENSOES_IMAGEM.has(extensao);
}

export default function DetalhesNcPage() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [nc, setNc] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [confirmarExclusaoNc, setConfirmarExclusaoNc] = useState(false);
  const [excluindoNc, setExcluindoNc] = useState(false);
  const [evidencias, setEvidencias] = useState([]);
  const [carregandoEvidencias, setCarregandoEvidencias] = useState(false);
  const [erroEvidencias, setErroEvidencias] = useState("");
  const [mensagemEvidencia, setMensagemEvidencia] = useState("");
  const [arquivoNovo, setArquivoNovo] = useState(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [falhaUpload, setFalhaUpload] = useState(false);
  const [confirmarExclusaoEvidencia, setConfirmarExclusaoEvidencia] =
    useState(false);
  const [evidenciaSelecionada, setEvidenciaSelecionada] = useState(null);
  const [excluindoEvidencia, setExcluindoEvidencia] = useState(false);
  const [evidenciaVisualizada, setEvidenciaVisualizada] = useState(null);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  async function baixarRelatorioPdf() {
    if (!id || baixandoPdf) return;
    setBaixandoPdf(true);
    try {
      const blob = await baixarPdfNc(id);
      salvarArquivoLocal(blob, `sgnc-nc-${id}.pdf`);
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível baixar o relatório da NC em PDF."
      );
    } finally {
      setBaixandoPdf(false);
    }
  }

  async function carregarNc() {
    try {
      setErro("");
      setNc(await buscarNc(id));
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : "Não foi possível carregar a NC."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function carregarEvidencias() {
    if (!id) return;
    setCarregandoEvidencias(true);
    setErroEvidencias("");
    try {
      setEvidencias(await listarEvidencias(id));
    } catch (e) {
      setErroEvidencias(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível carregar as evidências."
      );
    } finally {
      setCarregandoEvidencias(false);
    }
  }

  useEffect(() => {
    (async () => {
      await carregarNc();
      await carregarEvidencias();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function excluirNc() {
    if (enviandoArquivo) return;
    setExcluindoNc(true);
    try {
      await chamarApi(`/nc/${id}`, { method: "DELETE" });
      navigate("/");
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : "Não foi possível excluir a NC."
      );
      setConfirmarExclusaoNc(false);
    } finally {
      setExcluindoNc(false);
    }
  }

  function selecionarArquivo(evento) {
    setArquivoNovo(evento.target.files?.[0] || null);
    setFalhaUpload(false);
    setErroEvidencias("");
    setMensagemEvidencia("");
  }

  async function enviarEvidencia() {
    if (!arquivoNovo || !id || enviandoArquivo) return;
    setEnviandoArquivo(true);
    setFalhaUpload(false);
    setErroEvidencias("");
    setMensagemEvidencia("");
    try {
      await anexarEvidencia(id, arquivoNovo);
      setArquivoNovo(null);
      await carregarEvidencias();
      setMensagemEvidencia("Evidência anexada com sucesso.");
    } catch (e) {
      setFalhaUpload(true);
      setErroEvidencias(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível anexar a evidência."
      );
    } finally {
      setEnviandoArquivo(false);
    }
  }

  function abrirModalExclusaoEvidencia(evidencia) {
    if (enviandoArquivo) return;
    setEvidenciaSelecionada(evidencia);
    setConfirmarExclusaoEvidencia(true);
  }

  async function confirmarExcluirEvidencia() {
    if (!evidenciaSelecionada || !id || enviandoArquivo) return;
    setExcluindoEvidencia(true);
    setErroEvidencias("");
    setMensagemEvidencia("");
    try {
      await excluirEvidencia(id, evidenciaSelecionada.id);
      setConfirmarExclusaoEvidencia(false);
      setEvidenciaSelecionada(null);
      await carregarEvidencias();
    } catch (e) {
      setErroEvidencias(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível excluir a evidência."
      );
    } finally {
      setExcluindoEvidencia(false);
    }
  }

  const ehAdm = usuario?.papel === "adm";
  const ehSupervisor = usuario?.papel === "supervisor";
  const ehAutor = nc && usuario?.id === nc.aberto_por;
  const ehColaboradorDaNc = nc && usuario?.id === nc.colaborador_id;
  const ehResponsavel = nc && usuario?.id === nc.responsavel_id;

  // O backend/RLS já limita o supervisor às NCs dos subordinados diretos.
  const podeVerDetalhesCompletos =
    ehAdm || ehSupervisor || ehColaboradorDaNc || ehResponsavel;
  const podeVerResumo = ehAutor && !podeVerDetalhesCompletos;
  const podeEditar = nc && ehAdm && nc.status === "aberta";
  const podeExcluirNc = ehAdm;
  const aguardandoFeedback =
    nc && ["aguardando_feedback", "aguardando_analise"].includes(nc.status);

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container" style={{ maxWidth: "900px" }}>
        <CabecalhoPagina
          titulo={`NC #${id}`}
          subtitulo={
            nc
              ? nc.descricao?.slice(0, 80) || "Detalhes da não conformidade"
              : ""
          }
          acoes={
            nc && (
              <>
                <Botao
                  variante="primario"
                  tamanho="sm"
                  carregando={baixandoPdf}
                  disabled={baixandoPdf}
                  onClick={baixarRelatorioPdf}
                >
                  Baixar relatório PDF
                </Botao>
                {podeEditar && (
                  <Botao
                    variante="secundario"
                    tamanho="sm"
                    disabled={enviandoArquivo}
                    onClick={() => navigate(`/nc/${id}/editar`)}
                  >
                    Editar
                  </Botao>
                )}
                {podeExcluirNc && (
                  <Botao
                    variante="perigo"
                    tamanho="sm"
                    disabled={enviandoArquivo}
                    onClick={() => setConfirmarExclusaoNc(true)}
                  >
                    Excluir
                  </Botao>
                )}
              </>
            )
          }
        />

        <Link to="/" className="sg-voltar mb-3 d-inline-flex">
          &larr; Voltar para a lista
        </Link>
        {carregando && (
          <EstadoCarregamento mensagem="Carregando não conformidade..." />
        )}
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {nc && (
          <div className="d-flex flex-column gap-3">
            <div className="sg-card">
              <div className="sg-card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                  <h1 className="h5 mb-0">NC #{nc.id}</h1>
                  <div className="d-flex gap-2 flex-wrap">
                    <BadgePrioridade criticidade={nc.criticidade} />
                    <BadgeStatus status={nc.status} />
                  </div>
                </div>

                <dl className="mb-0">
                  <div className="sg-detalhe">
                    <dt className="sg-detalhe__rotulo">Ocorrência</dt>
                    <dd className="sg-detalhe__valor">{formatarData(nc.data)}</dd>
                  </div>
                  <div className="sg-detalhe">
                    <dt className="sg-detalhe__rotulo">Colaborador analisado</dt>
                    <dd className="sg-detalhe__valor">{nc.colaborador || "-"}</dd>
                  </div>
                  <div className="sg-detalhe">
                    <dt className="sg-detalhe__rotulo">Setor</dt>
                    <dd className="sg-detalhe__valor">{nc.setor || "-"}</dd>
                  </div>
                  <div className="sg-detalhe">
                    <dt className="sg-detalhe__rotulo">Chamado</dt>
                    <dd className="sg-detalhe__valor">{nc.chamado || "-"}</dd>
                  </div>
                  <div className="sg-detalhe">
                    <dt className="sg-detalhe__rotulo">Reincidência</dt>
                    <dd className="sg-detalhe__valor">{nc.reincidencia ?? "-"}</dd>
                  </div>
                  <div className="sg-detalhe">
                    <dt className="sg-detalhe__rotulo">Descrição</dt>
                    <dd className="sg-detalhe__valor">{nc.descricao || "-"}</dd>
                  </div>
                  <div className="sg-detalhe">
                    <dt className="sg-detalhe__rotulo">Causas</dt>
                    <dd className="sg-detalhe__valor">
                      {nc.causas?.length > 0 ? nc.causas.join(", ") : "-"}
                    </dd>
                  </div>

                  {podeVerDetalhesCompletos && nc.motivo_invalidacao && (
                    <div className="sg-detalhe">
                      <dt
                        className="sg-detalhe__rotulo"
                        style={{ color: "var(--erro)" }}
                      >
                        Motivo da invalidação
                      </dt>
                      <dd
                        className="sg-detalhe__valor"
                        style={{ color: "var(--erro)" }}
                      >
                        {nc.motivo_invalidacao}
                      </dd>
                    </div>
                  )}
                  {podeVerDetalhesCompletos && nc.feedback && (
                    <div className="sg-detalhe">
                      <dt className="sg-detalhe__rotulo">Feedback</dt>
                      <dd className="sg-detalhe__valor">{nc.feedback}</dd>
                    </div>
                  )}
                  {podeVerDetalhesCompletos && nc.texto_aceite && (
                    <div className="sg-detalhe">
                      <dt className="sg-detalhe__rotulo">Aceite registrado</dt>
                      <dd className="sg-detalhe__valor fst-italic">
                        "{nc.texto_aceite}"
                      </dd>
                    </div>
                  )}
                  {podeVerDetalhesCompletos && (
                    <>
                      {nc.validado_em && (
                        <div className="sg-detalhe">
                          <dt className="sg-detalhe__rotulo">Validado em</dt>
                          <dd className="sg-detalhe__valor">
                            {formatarDataHora(nc.validado_em)}
                          </dd>
                        </div>
                      )}
                      {nc.feedback_aplicado_em && (
                        <div className="sg-detalhe">
                          <dt className="sg-detalhe__rotulo">
                            Feedback aplicado em
                          </dt>
                          <dd className="sg-detalhe__valor">
                            {formatarDataHora(nc.feedback_aplicado_em)}
                          </dd>
                        </div>
                      )}
                      {nc.aceito_em && (
                        <div className="sg-detalhe">
                          <dt className="sg-detalhe__rotulo">Aceito em</dt>
                          <dd className="sg-detalhe__valor">
                            {formatarDataHora(nc.aceito_em)}
                          </dd>
                        </div>
                      )}
                      <div className="sg-detalhe">
                        <dt className="sg-detalhe__rotulo">Criado em</dt>
                        <dd className="sg-detalhe__valor">
                          {formatarDataHora(nc.criado_em)}
                        </dd>
                      </div>
                      <div className="sg-detalhe">
                        <dt className="sg-detalhe__rotulo">Atualizado em</dt>
                        <dd className="sg-detalhe__valor">
                          {formatarDataHora(nc.atualizado_em)}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>

                {podeVerResumo && (
                  <div className="sg-alerta sg-alerta--info mt-3 mb-0">
                    Você abriu esta NC para {nc.colaborador}. Aqui você acompanha
                    o status e os dados que registrou.
                  </div>
                )}
              </div>
            </div>

            <div >
              {podeVerDetalhesCompletos && ehAdm && nc.status === "aberta" && (
                <PainelAvaliar
                  nc={nc}
                  aoConcluir={setNc}
                  bloqueado={enviandoArquivo}
                />
              )}
              {podeVerDetalhesCompletos && ehAdm && aguardandoFeedback && (
                <PainelFeedback nc={nc} aoConcluir={setNc} />
              )}
              {podeVerDetalhesCompletos &&
                ehColaboradorDaNc &&
                nc.status === "aguardando_aceite" && (
                  <PainelAceite nc={nc} aoConcluir={setNc} />
                )}
            </div>

            {podeVerDetalhesCompletos && (
              <div className="sg-card">
                <div className="sg-card-body p-4">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div>
                      <h2 className="h6 mb-1">Evidências</h2>
                      {enviandoArquivo && (
                        <div className="texto-xs texto-suave">
                          Enviando arquivo. Aguarde antes de avaliar a NC.
                        </div>
                      )}
                    </div>
                    {nc.status === "aberta" &&
                      (ehAdm || ehAutor || ehColaboradorDaNc) && (
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <Form.Control
                            type="file"
                            size="sm"
                            className="sg-input"
                            disabled={enviandoArquivo}
                            onChange={selecionarArquivo}
                          />
                          <Botao
                            variante={falhaUpload ? "secundario" : "primario"}
                            tamanho="sm"
                            carregando={enviandoArquivo}
                            disabled={!arquivoNovo || enviandoArquivo}
                            onClick={enviarEvidencia}
                          >
                            {falhaUpload ? "Tentar novamente" : "Anexar"}
                          </Botao>
                        </div>
                      )}
                  </div>

                  {erroEvidencias && (
                    <MensagemErro
                      mensagem={erroEvidencias}
                      onFechar={() => setErroEvidencias("")}
                    />
                  )}
                  {mensagemEvidencia && (
                    <div className="sg-alerta sg-alerta--sucesso mb-3">
                      {mensagemEvidencia}
                    </div>
                  )}
                  {carregandoEvidencias && (
                    <EstadoCarregamento
                      mensagem="Carregando evidências..."
                      compacto
                    />
                  )}
                  {!carregandoEvidencias && evidencias.length === 0 && (
                    <EstadoVazio
                      titulo="Nenhuma evidência anexada"
                      descricao="As evidências enviadas aparecerão aqui."
                    />
                  )}
                  {!carregandoEvidencias && evidencias.length > 0 && (
                    <div className="sg-evidencias-lista">
                      {evidencias.map((ev) => (
                        <div key={ev.id} className="sg-evidencia-item">
                          <div className="me-3 min-w-0">
                            <div className="sg-evidencia-item__nome">
                              {ev.nome_original}
                            </div>
                            {ev.url_temporaria &&
                              (ehImagem(ev.nome_original) ? (
                                <button
                                  type="button"
                                  className="sg-evidencia-item__link sg-evidencia-item__link--botao"
                                  onClick={() => setEvidenciaVisualizada(ev)}
                                >
                                  Visualizar imagem
                                </button>
                              ) : (
                                <a
                                  href={ev.url_temporaria}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="sg-evidencia-item__link"
                                >
                                  Abrir arquivo
                                </a>
                              ))}
                          </div>
                          {(ehAdm || (ehAutor && nc.status === "aberta")) && (
                            <Botao
                              variante="secundario"
                              tamanho="sm"
                              disabled={enviandoArquivo}
                              onClick={() => abrirModalExclusaoEvidencia(ev)}
                            >
                              Remover
                            </Botao>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Container>

      <Modal
        show={confirmarExclusaoNc}
        onHide={() => !enviandoArquivo && setConfirmarExclusaoNc(false)}
        centered
      >
        <Modal.Header closeButton={!enviandoArquivo}>
          <Modal.Title className="h5">Excluir NC #{id}?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Esta ação é permanente e não pode ser desfeita. Tem certeza?
        </Modal.Body>
        <Modal.Footer>
          <Botao
            variante="secundario"
            onClick={() => setConfirmarExclusaoNc(false)}
            disabled={excluindoNc || enviandoArquivo}
          >
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            onClick={excluirNc}
            carregando={excluindoNc}
            disabled={enviandoArquivo}
          >
            Sim, excluir
          </Botao>
        </Modal.Footer>
      </Modal>

      <Modal
        show={confirmarExclusaoEvidencia}
        onHide={() => {
          if (excluindoEvidencia) return;
          setConfirmarExclusaoEvidencia(false);
          setEvidenciaSelecionada(null);
        }}
        centered
      >
        <Modal.Header closeButton={!excluindoEvidencia}>
          <Modal.Title className="h5">
            Remover evidência
            {evidenciaSelecionada
              ? ` "${evidenciaSelecionada.nome_original}"`
              : ""}
            ?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Esta ação é permanente e remove o arquivo do storage e da lista de
          evidências desta NC. Deseja continuar?
        </Modal.Body>
        <Modal.Footer>
          <Botao
            variante="secundario"
            onClick={() => {
              setConfirmarExclusaoEvidencia(false);
              setEvidenciaSelecionada(null);
            }}
            disabled={excluindoEvidencia}
          >
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            onClick={confirmarExcluirEvidencia}
            carregando={excluindoEvidencia}
          >
            Sim, remover
          </Botao>
        </Modal.Footer>
      </Modal>

      <ModalVisualizarEvidencia
        visivel={evidenciaVisualizada !== null}
        evidencia={evidenciaVisualizada}
        aoFechar={() => setEvidenciaVisualizada(null)}
      />
    </div>
  );
}
