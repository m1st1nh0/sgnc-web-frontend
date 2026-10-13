"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Container from "react-bootstrap/Container";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import PainelAvaliar from "./PainelAvaliar.jsx";
import PainelFeedback from "./PainelFeedback.jsx";
import PainelAceite from "./PainelAceite.jsx";
import PainelPlanoAcao from "./PainelPlanoAcao.jsx";
import EtapasNc from "./EtapasNc.jsx";
import HistoricoNc from "./HistoricoNc.jsx";
import FeedbackNc from "./FeedbackNc.jsx";
import {
  buscarNc,
  listarEvidencias,
  anexarEvidencia,
  excluirEvidencia,
} from "../client/ncService.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { ErroApi, chamarApi } from "../../../lib/api/client/api.js";
import { baixarPdfNc } from "../../reports/client/relatoriosService.js";
import { salvarArquivoLocal } from "../../../lib/utils/arquivoLocal.js";
import { formatarData, formatarDataHora } from "../../../lib/utils/formato.js";
import { rotuloRetorno } from "../../../lib/utils/retorno.js";
import Botao from "../../../components/ui/Botao.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import ModalVisualizarEvidencia from "../../../components/ui/ModalVisualizarEvidencia.jsx";
import BadgeStatus from "../../../components/ui/BadgeStatus.jsx";
import BadgePrioridade from "../../../components/ui/BadgePrioridade.jsx";
import DicaContextual from "../../onboarding/components/DicaContextual.jsx";
import { useOnboarding } from "../../onboarding/components/OnboardingContext.jsx";
import { ehQualidade } from "../../../lib/auth/papeis.js";

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

export default function DetalhesNcPage({ retorno = "/" }) {
  const { id } = useParams();
  const { usuario } = useAuth();
  const { concluirEtapa } = useOnboarding();
  const router = useRouter();

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
  const [avisoUploadInicial, setAvisoUploadInicial] = useState("");
  const [confirmacaoAbertura, setConfirmacaoAbertura] = useState(false);

  useEffect(() => {
    if (!id) return;
    const chave = `sgnc-nc-${id}-upload-warning`;
    let aviso = null;
    let registrada = false;
    try {
      aviso = sessionStorage.getItem(chave);
      if (aviso) sessionStorage.removeItem(chave);
      // Confirmação única logo após abrir a NC (gravada pela tela de abertura).
      const chaveRegistrada = `sgnc-nc-${id}-registrada`;
      registrada = sessionStorage.getItem(chaveRegistrada) === "1";
      if (registrada) sessionStorage.removeItem(chaveRegistrada);
    } catch {
      // Armazenamento indisponível: segue sem os avisos de abertura.
    }
    if (aviso || registrada) {
      const timer = window.setTimeout(() => {
        if (aviso) setAvisoUploadInicial(aviso);
        if (registrada) setConfirmacaoAbertura(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [id]);

  async function baixarRelatorioPdf() {
    if (!id || baixandoPdf) return;
    setBaixandoPdf(true);
    try {
      const blob = await baixarPdfNc(id);
      salvarArquivoLocal(blob, `sgnc-nc-${id}.pdf`);
      await concluirEtapa("checklist_baixar_pdf", "checklist", {
        origem_documento: "relatorio_nc",
        nc_id: id,
      });
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
      const ncCarregada = await buscarNc(id);
      setNc(ncCarregada);
      // Onboarding é auxiliar: registra em segundo plano, sem segurar o detalhe.
      void (async () => {
        await concluirEtapa("checklist_visualizar_nc", "checklist", {
          nc_id: id,
        });
        if (usuario?.papel === "supervisor") {
          await concluirEtapa("checklist_acompanhar_nc", "checklist", {
            nc_id: id,
          });
        }
      })();
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : "Não foi possível carregar a NC."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function recarregarNc() {
    try {
      setNc(await buscarNc(id));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível atualizar a NC.");
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
    // NC e evidências em paralelo: a listagem de evidências faz a própria checagem de acesso.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([carregarNc(), carregarEvidencias()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function excluirNc() {
    if (enviandoArquivo) return;
    setExcluindoNc(true);
    try {
      await chamarApi(`/nc/${id}`, { method: "DELETE" });
      router.push(retorno);
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
      if (usuario?.papel === "funcionario") {
        await concluirEtapa("checklist_evidencias", "checklist", {
          nc_id: id,
        });
      }
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

  function aoConcluirAvaliacao(ncAtualizada) {
    setNc(ncAtualizada);
    concluirEtapa("checklist_avaliar_nc", "checklist", { nc_id: id });
  }

  function aoConcluirFeedback(ncAtualizada, avisoAnexos = "") {
    setNc(ncAtualizada);
    if (avisoAnexos) setAvisoUploadInicial(avisoAnexos);
    void carregarEvidencias();
    concluirEtapa("checklist_feedback", "checklist", { nc_id: id });
  }

  function aoConcluirAceite(ncAtualizada) {
    setNc(ncAtualizada);
    concluirEtapa("checklist_aceite", "checklist", { nc_id: id });
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

  const ehAdm = ehQualidade(usuario?.papel);
  const ehAutor = nc && usuario?.id === nc.aberto_por;
  const ehColaboradorDaNc = nc && usuario?.id === nc.colaborador_id;
  // Segregação de funções: quem é objeto da NC não exerce os poderes da Qualidade sobre ela.
  const ehQualidadeSemConflito = ehAdm && !ehColaboradorDaNc;

  // O backend limita o supervisor à hierarquia autorizada de liderados.
  // O servidor calcula o acesso pela hierarquia real: supervisor só vê completo a própria equipe.
  const podeVerDetalhesCompletos = nc?.acesso_completo === true;
  const podeVerResumo = ehAutor && !podeVerDetalhesCompletos;
  const podeEditar = nc && ehQualidadeSemConflito && nc.status === "aberta";
  const podeExcluirNc = nc && ehQualidadeSemConflito && !nc.critica;
  // Anexos do feedback aparecem na seção Feedback; aqui ficam só as evidências da abertura.
  const anexosFeedback = evidencias.filter((ev) => ev.feedback_id != null);
  const evidenciasAbertura = evidencias.filter((ev) => ev.feedback_id == null);
  const aguardandoFeedback =
    nc && ["aguardando_feedback", "aguardando_analise"].includes(nc.status);
  return (
    <div>
      <Container className="sg-container sg-detalhe-nc">
        <Link href={retorno} className="sg-voltar">
          &larr; {rotuloRetorno(retorno)}
        </Link>

        <header className="sg-pagina-cabecalho sg-detalhe-nc__cabecalho">
          <div className="sg-pagina-cabecalho__texto">
            <div className="sg-detalhe-nc__selos">
              <span className="sg-mono">NC #{id}</span>
              {nc && <BadgeStatus status={nc.status} />}
              {nc && <BadgePrioridade criticidade={nc.criticidade} />}
              {nc?.critica && <span className="sg-badge sg-badge--vermelho">NC crítica</span>}
            </div>
            <h1>{nc?.colaborador || `NC #${id}`}</h1>
            {nc && (
              <p>
                {[nc.setor, nc.chamado && `Chamado ${nc.chamado}`, `ocorrência em ${formatarData(nc.data)}`].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {nc && (
            <div className="sg-pagina-cabecalho__acoes">
                <Botao
                  variante="primario"
                  tamanho="md"
                  carregando={baixandoPdf}
                  disabled={baixandoPdf}
                  onClick={baixarRelatorioPdf}
                >
                  Baixar relatório PDF
                </Botao>
                {podeEditar && (
                  <Botao
                    variante="secundario"
                    tamanho="md"
                    disabled={enviandoArquivo}
                    onClick={() => router.push(`/nc/${id}/editar`)}
                  >
                    Editar
                  </Botao>
                )}
                {podeExcluirNc && (
                  <Botao
                    variante="perigo"
                    tamanho="md"
                    disabled={enviandoArquivo}
                    onClick={() => setConfirmarExclusaoNc(true)}
                  >
                    Excluir
                  </Botao>
                )}
            </div>
          )}
        </header>

        <DicaContextual chave="dica_nc_pdf" className="mb-3" />

        {avisoUploadInicial && (
          <div className="sg-alerta sg-alerta--atencao mb-3" role="status">
            {avisoUploadInicial}
          </div>
        )}
        {carregando && (
          <EstadoCarregamento mensagem="Carregando não conformidade..." />
        )}
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {nc && (
          <div className="sg-detalhe-nc__conteudo">
            {confirmacaoAbertura && (
              <div className="sg-alerta sg-alerta--sucesso mb-0" role="status">
                <div>
                  <strong>NC #{id} registrada.</strong> Próximo passo: a Qualidade avalia.
                  Você acompanha por aqui ou em <Link href="/minhas-ncs">Minhas NCs</Link>.
                </div>
              </div>
            )}
            <EtapasNc nc={nc} visualizadorId={usuario?.id} />
            {nc.sua_acao && (
              <div className="sg-alerta sg-alerta--atencao mb-0" role="status">
                <div>
                  <strong>Você é responsável por uma ação desta NC.</strong>{" "}
                  {nc.sua_acao.acao_combinada}
                  {nc.sua_acao.prazo_acao && <> Prazo: {formatarData(nc.sua_acao.prazo_acao)}.</>}
                </div>
              </div>
            )}

            <div className="sg-detalhe-nc__grade">
              <div className="sg-detalhe-nc__principal">
                <section className="sg-cartao" aria-labelledby="dados-ocorrencia-titulo">
                  <h2 id="dados-ocorrencia-titulo" className="sg-secao-titulo">Dados da ocorrência</h2>
                  <dl className="sg-dados">
                    <div><dt>Colaborador analisado</dt><dd>{nc.colaborador || "—"}</dd></div>
                    <div><dt>Setor</dt><dd>{nc.setor || "—"}</dd></div>
                    <div><dt>Chamado</dt><dd>{nc.chamado || "—"}</dd></div>
                    <div><dt>Data da ocorrência</dt><dd>{formatarData(nc.data)}</dd></div>
                    <div><dt>Causas</dt><dd>{nc.causas?.length > 0 ? nc.causas.join(", ") : "—"}</dd></div>
                    <div><dt>Reincidência</dt><dd>{nc.reincidencia ?? "—"}</dd></div>
                  </dl>
                  <div className="sg-detalhe-nc__descricao">
                    <span className="sg-detalhe-nc__rotulo">Descrição</span>
                    <p>{nc.descricao || "—"}</p>
                  </div>
                  {podeVerDetalhesCompletos && nc.motivo_invalidacao && (
                    <div className="sg-detalhe-nc__descricao sg-detalhe-nc__descricao--erro">
                      <span className="sg-detalhe-nc__rotulo">Motivo da invalidação</span>
                      <p>{nc.motivo_invalidacao}</p>
                    </div>
                  )}
                  {podeVerDetalhesCompletos && nc.feedback && !nc.feedback_estruturado && (
                    <div className="sg-detalhe-nc__descricao">
                      <span className="sg-detalhe-nc__rotulo">Feedback</span>
                      <p>{nc.feedback}</p>
                    </div>
                  )}
                  {podeVerDetalhesCompletos && nc.texto_aceite && (
                    <div className="sg-detalhe-nc__descricao">
                      <span className="sg-detalhe-nc__rotulo">Aceite registrado</span>
                      <p className="fst-italic">"{nc.texto_aceite}"</p>
                    </div>
                  )}
                  {podeVerResumo && (
                    <div className="sg-alerta sg-alerta--info mt-3 mb-0">
                      Você abriu esta NC para {nc.colaborador}. Aqui você acompanha
                      o status e os dados que registrou.
                    </div>
                  )}
                </section>

            {podeVerDetalhesCompletos && (
              <FeedbackNc nc={nc} anexos={anexosFeedback} aoVisualizarAnexo={setEvidenciaVisualizada} />
            )}

            <div className="sg-detalhe-nc__acoes-fluxo">
              {ehAdm && ehColaboradorDaNc && !["concluida", "invalidada"].includes(nc.status) && (
                <div className="sg-alerta sg-alerta--atencao mb-3" role="status">
                  Você é o colaborador analisado nesta NC. Avaliação, feedback, edição, exclusão e o
                  plano de ação devem ser conduzidos por outra pessoa da Qualidade.
                </div>
              )}
              {podeVerDetalhesCompletos && ehQualidadeSemConflito && nc.status === "aberta" && (
                <>
                  <DicaContextual chave="dica_nc_avaliacao" className="mb-3" />
                  <PainelAvaliar
                    nc={nc}
                    aoConcluir={aoConcluirAvaliacao}
                    bloqueado={enviandoArquivo}
                  />
                </>
              )}
              {podeVerDetalhesCompletos && ehQualidadeSemConflito && aguardandoFeedback && (
                <>
                  <DicaContextual chave="dica_nc_feedback" className="mb-3" />
                  <PainelFeedback nc={nc} aoConcluir={aoConcluirFeedback} />
                </>
              )}
              {podeVerDetalhesCompletos &&
                ehColaboradorDaNc &&
                ["aguardando_aceite", "nao_respondida"].includes(nc.status) && (
                  <>
                    <DicaContextual chave="dica_nc_aceite" className="mb-3" />
                    <PainelAceite nc={nc} aoConcluir={aoConcluirAceite} />
                  </>
                )}
              {podeVerDetalhesCompletos && (
                <div className="mt-3">
                  <PainelPlanoAcao nc={nc} aoAlterarNc={recarregarNc} />
                </div>
              )}
            </div>

              </div>

              <aside className="sg-detalhe-nc__lateral" aria-label="Linha do tempo, evidências e datas">
                <HistoricoNc ncId={id} versao={`${nc.status}-${nc.critica}-${nc.atualizado_em ?? ""}`} />
            {podeVerDetalhesCompletos && (
              <section className="sg-cartao" aria-labelledby="evidencias-abertura-titulo">
                <div>
                  <div className="d-flex flex-column gap-2 mb-3">
                    <div>
                      <h2 id="evidencias-abertura-titulo" className="sg-secao-titulo mb-1">Evidências da abertura</h2>
                      {enviandoArquivo && (
                        <div className="texto-xs texto-suave">
                          Enviando arquivo. Aguarde antes de avaliar a NC.
                        </div>
                      )}
                    </div>
                    {nc.status === "aberta" &&
                      (ehAdm || ehAutor || ehColaboradorDaNc) && (
                        <div className="sg-detalhe-nc__anexar">
                          <Form.Control
                            type="file"
                            size="sm"
                            className="sg-input"
                            aria-label="Selecionar arquivo de evidência"
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
                  {!carregandoEvidencias && evidenciasAbertura.length === 0 && (
                    <EstadoVazio
                      titulo="Nenhuma evidência anexada"
                      descricao="As evidências enviadas aparecerão aqui."
                    />
                  )}
                  {!carregandoEvidencias && evidenciasAbertura.length > 0 && (
                    <div className="sg-evidencias-lista">
                      {evidenciasAbertura.map((ev) => (
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
                          {(ehQualidadeSemConflito || (ehAutor && !ehColaboradorDaNc && nc.status === "aberta")) && (
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
              </section>
            )}
                {podeVerDetalhesCompletos && (
                  <section className="sg-cartao" aria-labelledby="datas-nc-titulo">
                    <h2 id="datas-nc-titulo" className="visually-hidden">Datas</h2>
                    <dl className="sg-dados sg-dados--duas">
                      <div><dt>Criada em</dt><dd>{formatarDataHora(nc.criado_em)}</dd></div>
                      {nc.validado_em && <div><dt>Validada em</dt><dd>{formatarDataHora(nc.validado_em)}</dd></div>}
                      {nc.feedback_aplicado_em && <div><dt>Feedback aplicado em</dt><dd>{formatarDataHora(nc.feedback_aplicado_em)}</dd></div>}
                      {nc.aceito_em && <div><dt>Aceita em</dt><dd>{formatarDataHora(nc.aceito_em)}</dd></div>}
                      <div><dt>Atualizada em</dt><dd>{formatarDataHora(nc.atualizado_em)}</dd></div>
                      <div><dt>Crítica</dt><dd>{nc.critica ? "Sim" : "Não"}</dd></div>
                    </dl>
                  </section>
                )}
              </aside>
            </div>
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
