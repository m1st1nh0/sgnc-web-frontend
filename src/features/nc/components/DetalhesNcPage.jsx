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
import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
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

function resumirDescricao(descricao, limite = 90) {
  const texto = String(descricao || "").trim();
  if (texto.length <= limite) return texto;
  const corte = texto.slice(0, limite);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(" "), limite * 0.6)).trimEnd()}…`;
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

  useEffect(() => {
    if (!id) return;
    const chave = `sgnc-nc-${id}-upload-warning`;
    const aviso = sessionStorage.getItem(chave);
    if (aviso) {
      sessionStorage.removeItem(chave);
      const timer = window.setTimeout(() => setAvisoUploadInicial(aviso), 0);
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
      await concluirEtapa("checklist_visualizar_nc", "checklist", {
        nc_id: id,
      });
      if (usuario?.papel === "supervisor") {
        await concluirEtapa("checklist_acompanhar_nc", "checklist", {
          nc_id: id,
        });
      }
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

  function aoConcluirFeedback(ncAtualizada) {
    setNc(ncAtualizada);
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
  const aguardandoFeedback =
    nc && ["aguardando_feedback", "aguardando_analise"].includes(nc.status);
  const proximaAcao = nc ? {
    aberta: ["Qualidade", "Avaliar a ocorrência e definir se ela segue para análise."],
    aguardando_feedback: ["Qualidade", "Registrar o feedback e o combinado com o colaborador."],
    aguardando_analise: ["Qualidade", "Registrar o feedback e o combinado com o colaborador."],
    aguardando_aceite: [nc.colaborador || "Colaborador analisado", "Ler o feedback e registrar o aceite formal."],
    em_plano_acao: ["Qualidade e liderança", "Executar e acompanhar o plano de ação; a Qualidade verifica a eficácia para concluir."],
    validada: ["Qualidade", "A análise foi validada; acompanhe o próximo encaminhamento."],
    concluida: ["Concluída", "Não há ação pendente nesta não conformidade."],
    invalidada: ["Encerrada", nc.motivo_invalidacao || "A ocorrência foi invalidada."],
  }[nc.status] : null;

  return (
    <div>
      <Container className="sg-container" style={{ maxWidth: "900px" }}>
        <Link href={retorno} className="sg-voltar mb-3 d-inline-flex">
          &larr; {rotuloRetorno(retorno)}
        </Link>
        <CabecalhoPagina
          titulo={`NC #${id}`}
          subtitulo={
            nc
              ? resumirDescricao(nc.descricao) || "Detalhes da não conformidade"
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
                    onClick={() => router.push(`/nc/${id}/editar`)}
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
          <div className="d-flex flex-column gap-3">
            {proximaAcao && (
              <section className="sg-alerta sg-alerta--info mb-0" aria-label="Próxima ação">
                <strong>Próxima ação: {proximaAcao[0]}</strong>
                <div>{proximaAcao[1]}</div>
              </section>
            )}
            <div className="sg-card">
              <div className="sg-card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                  <h2 className="h5 mb-0">Dados da ocorrência</h2>
                  <div className="d-flex gap-2 flex-wrap">
                    {nc.critica && <span className="sg-badge sg-badge--vermelho">NC crítica</span>}
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

            <div>
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
                nc.status === "aguardando_aceite" && (
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
