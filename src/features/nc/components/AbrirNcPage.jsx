"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import CampoCausas from "./CampoCausas.jsx";
import { listarOpcoesNc } from "../../users/client/usuarioService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { abrirNc, listarCausasConhecidas, anexarEvidencia, solicitarCausa } from "../client/ncService.js";
import Botao from "../../../components/ui/Botao.jsx";
import CampoTexto from "../../../components/ui/CampoTexto.jsx";
import CampoTextoArea from "../../../components/ui/CampoTextoArea.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import DicaContextual from "../../onboarding/components/DicaContextual.jsx";
import { useOnboarding } from "../../onboarding/components/OnboardingContext.jsx";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { ehQualidade } from "../../../lib/auth/papeis.js";
import { focarPrimeiroErro, resumoErros } from "../client/errosFormulario.js";

const IDS_CAMPOS = {
  colaborador: "busca-colaborador",
  criticidade: "criticidade-nc",
  descricao: "descricao-nc",
  causas: "campo-causas",
};

const OPCOES_CRITICIDADE = ["Baixa", "Média", "Alta"];
const FORMATOS_EVIDENCIA =
  ".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xlsx";
const EXPLICACOES_CRITICIDADE = {
  Baixa: "Baixo impacto e sem interrupção relevante da operação.",
  Média: "Impacto perceptível, retrabalho ou risco moderado para a operação.",
  Alta: "Impacto grave, interrupção ou risco elevado que exige prioridade.",
};

function PreviewImagem({ arquivo, aoFechar }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="sg-preview-evidencia" role="dialog" aria-label={`Pré-visualização de ${arquivo.name}`}>
      <div className="sg-preview-evidencia__cabecalho">
        <div><strong>Confirme a imagem</strong><span>{arquivo.name}</span></div>
        <button type="button" onClick={aoFechar}>Fechar preview</button>
      </div>
      <img src={url} alt={`Pré-visualização de ${arquivo.name}`} />
    </div>
  );
}

function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export default function AbrirNcPage() {
  const router = useRouter();
  const { concluirEtapa } = useOnboarding();
  const { usuario } = useAuth();

  const [chamado, setChamado] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [criticidade, setCriticidade] = useState("Baixa");
  const [descricao, setDescricao] = useState("");
  const [causas, setCausas] = useState([]);
  const [causaPendente, setCausaPendente] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [causasConhecidas, setCausasConhecidas] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisoCausa, setAvisoCausa] = useState("");
  const [errosCampo, setErrosCampo] = useState({});
  const [arquivosEvidencias, setArquivosEvidencias] = useState([]);
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [etapaEnvio, setEtapaEnvio] = useState("");
  const [previewArquivo, setPreviewArquivo] = useState(null);

  useEffect(() => {
    async function carregarDadosDeApoio() {
      try {
        const [listaUsuarios, listaCausas] = await Promise.all([
          listarOpcoesNc(),
          listarCausasConhecidas(),
        ]);
        setUsuarios(listaUsuarios);
        setCausasConhecidas(listaCausas);
        void concluirEtapa("checklist_abrir_nc", "checklist", {
          pagina: "abrir-nc",
        });
      } catch (e) {
        setErro(
          e instanceof ErroApi
            ? e.message
            : "Não foi possível carregar os dados do formulário."
        );
      } finally {
        setCarregandoDados(false);
      }
    }
    carregarDadosDeApoio();
    // Dados de apoio carregados apenas na montagem do formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Causas cadastradas em Gestão de causas (outra aba) aparecem ao voltar para o formulário.
    function atualizarCatalogo() {
      listarCausasConhecidas().then(setCausasConhecidas).catch(() => {});
    }
    window.addEventListener("focus", atualizarCatalogo);
    return () => window.removeEventListener("focus", atualizarCatalogo);
  }, []);

  const colaboradorSelecionado = usuarios.find((u) => u.id === colaboradorId);
  const usuarioQualidade = ehQualidade(usuario?.papel);

  function mostrarErrosCampo(erros, mensagemTopo) {
    setErrosCampo(erros);
    setErro(mensagemTopo || resumoErros(erros));
    focarPrimeiroErro(erros, IDS_CAMPOS);
  }

  async function solicitarNovaCausa(dados) {
    await solicitarCausa(dados);
    setAvisoCausa("Solicitação enviada. A causa ficará disponível após aprovação da Qualidade.");
  }
  const usuariosFiltrados = useMemo(() => {
    const termo = buscaColaborador.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return usuarios;
    return usuarios.filter((item) =>
      `${item.nome || ""} ${item.setor || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(termo)
    );
  }, [buscaColaborador, usuarios]);

  function removerArquivo(indice) {
    const removido = arquivosEvidencias[indice];
    if (removido === previewArquivo) setPreviewArquivo(null);
    setArquivosEvidencias((atuais) => atuais.filter((_, i) => i !== indice));
  }

  function selecionarArquivos(evento) {
    const novosArquivos = Array.from(evento.target.files || []);
    setArquivosEvidencias((atuais) => {
      const arquivosUnicos = new Map(
        [...atuais, ...novosArquivos].map((arquivo) => [
          `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`,
          arquivo,
        ])
      );
      return Array.from(arquivosUnicos.values());
    });
    setPreviewArquivo(
      novosArquivos.find((arquivo) => arquivo.type.startsWith("image/")) || null
    );
    evento.target.value = "";
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");
    setErrosCampo({});

    const novosErros = {};
    if (!colaboradorId) {
      novosErros.colaborador = "Selecione o colaborador sobre quem é a Não Conformidade.";
    }
    if (!descricao.trim()) {
      novosErros.descricao = "Descreva o que aconteceu.";
    }
    if (causaPendente) {
      novosErros.causas = `“${causaPendente}” não foi adicionada. Selecione uma causa da lista ou apague o texto digitado.`;
    }
    if (Object.keys(novosErros).length > 0) {
      mostrarErrosCampo(novosErros);
      return;
    }

    setEnviando(true);
    try {
      setEtapaEnvio("Criando a NC...");
      const nc = await abrirNc({
        chamado: chamado || null,
        colaborador_id: colaboradorId,
        criticidade,
        descricao,
        causas,
      });

      if (arquivosEvidencias.length > 0) {
        setEtapaEnvio(`Enviando ${arquivosEvidencias.length} evidência(s)...`);
        const resultados = await Promise.allSettled(
          arquivosEvidencias.map((arquivo) => anexarEvidencia(nc.id, arquivo))
        );
        const falhas = resultados.filter((resultado) => resultado.status === "rejected").length;
        if (falhas > 0) {
          sessionStorage.setItem(
            `sgnc-nc-${nc.id}-upload-warning`,
            `${falhas} de ${arquivosEvidencias.length} evidência(s) não puderam ser enviadas. A NC foi criada; você pode tentar anexá-las novamente na seção Evidências.`
          );
        }
      }
      try {
        sessionStorage.setItem(`sgnc-nc-${nc.id}-registrada`, "1");
      } catch {
        // Sem armazenamento, o detalhe abre sem a confirmação única.
      }
      router.push(`/nc/${nc.id}`);
    } catch (e) {
      if (e instanceof ErroApi && e.campo && IDS_CAMPOS[e.campo]) {
        mostrarErrosCampo({ [e.campo]: e.message }, `A NC não foi aberta. ${resumoErros({ [e.campo]: e.message })}`);
      } else {
        setErro(
          e instanceof ErroApi
            ? `A NC não foi aberta. ${e.message} Seus dados continuam no formulário.`
            : "Não foi possível salvar a Não Conformidade. Seus dados continuam no formulário; tente novamente."
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setEnviando(false);
      setEtapaEnvio("");
    }
  }

  return (
    <div>
      <Container className="sg-container sg-form-nc">
        <header className="sg-pagina-cabecalho">
          <div className="sg-pagina-cabecalho__texto">
            <h1>Abrir não conformidade</h1>
            <p>Registre o fato com clareza. A Qualidade fará a avaliação depois.</p>
          </div>
        </header>

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        {avisoCausa && <div className="sg-alerta sg-alerta--sucesso mb-3" role="status">{avisoCausa}</div>}

        {carregandoDados ? (
          <EstadoCarregamento mensagem="Carregando dados do formulário..." />
        ) : (
          <div className="sg-form-nc__grade">
            <Form id="form-abrir-nc" onSubmit={aoEnviar} className="sg-form-nc__secoes">
              <section className="sg-cartao" aria-labelledby="abrir-passo-1">
                <div className="sg-form-nc__passo">
                  <span className="sg-form-nc__numero" aria-hidden="true">1</span>
                  <div>
                    <h2 id="abrir-passo-1" className="sg-secao-titulo mb-1">Quem e onde</h2>
                    <p className="sg-texto-apoio mb-0">Localize o colaborador ativo e confira o setor antes de continuar.</p>
                  </div>
                </div>

                <DicaContextual
                  chave="dica_abertura_colaborador"
                  className="mb-3"
                />

                <div className="sg-form-nc__linha">
                  <Form.Group className="sg-form-nc__campo-largo">
                    <Form.Label className="sg-label" htmlFor={IDS_CAMPOS.colaborador}>
                      Colaborador analisado <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      id={IDS_CAMPOS.colaborador}
                      type="search"
                      className="sg-input"
                      aria-invalid={errosCampo.colaborador ? true : undefined}
                      value={buscaColaborador}
                      onChange={(e) => setBuscaColaborador(e.target.value)}
                      placeholder="Digite o nome ou setor para localizar"
                      aria-describedby="ajuda-colaborador"
                    />
                    <Form.Text id="ajuda-colaborador" className="sg-helper">
                      Clique em uma pessoa abaixo para selecioná-la. A busca apenas filtra os resultados.
                    </Form.Text>
                  </Form.Group>
                  <CampoTexto
                    rotulo="Chamado"
                    value={chamado}
                    onChange={(e) => setChamado(e.target.value)}
                    placeholder="Número ou referência do chamado"
                    helper="Opcional. Relaciona a NC a um chamado do helpdesk."
                  />
                </div>

                <div className="sg-seletor-colaborador" role="listbox" aria-label="Colaboradores ativos">
                  {usuariosFiltrados.length === 0 ? (
                    <div className="sg-seletor-colaborador__vazio">
                      Nenhum colaborador encontrado para “{buscaColaborador}”.
                    </div>
                  ) : (
                    usuariosFiltrados.map((pessoa) => {
                      const selecionado = pessoa.id === colaboradorId;
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={selecionado}
                          className={`sg-seletor-colaborador__opcao ${selecionado ? "sg-seletor-colaborador__opcao--ativa" : ""}`}
                          key={pessoa.id}
                          onClick={() => {
                            setColaboradorId(pessoa.id);
                            setErrosCampo((atual) => ({ ...atual, colaborador: "" }));
                          }}
                        >
                          <span className="sg-seletor-colaborador__avatar" aria-hidden="true">
                            {(pessoa.nome || "?").trim().charAt(0).toUpperCase()}
                          </span>
                          <span><strong>{pessoa.nome}</strong><small>{pessoa.setor || "Setor não informado"}</small></span>
                          <span className="sg-seletor-colaborador__marca">{selecionado ? "Selecionado" : "Selecionar"}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                {errosCampo.colaborador && <div className="sg-erro-campo mt-2">{errosCampo.colaborador}</div>}
              </section>

              <section className="sg-cartao" aria-labelledby="abrir-passo-2">
                <div className="sg-form-nc__passo">
                  <span className="sg-form-nc__numero" aria-hidden="true">2</span>
                  <div>
                    <h2 id="abrir-passo-2" className="sg-secao-titulo mb-1">O que aconteceu</h2>
                    <p className="sg-texto-apoio mb-0">Informe fatos observáveis, impacto e contexto. Evite julgamentos pessoais.</p>
                  </div>
                </div>

                <fieldset className="sg-segmentado" aria-describedby="explicacao-criticidade">
                  <legend className="sg-label">Criticidade <span className="text-danger">*</span></legend>
                  <div className="sg-segmentado__opcoes">
                    {OPCOES_CRITICIDADE.map((opcao, indice) => (
                      <label key={opcao} className="sg-segmentado__opcao">
                        <input
                          type="radio"
                          name="criticidade"
                          id={indice === 0 ? IDS_CAMPOS.criticidade : undefined}
                          value={opcao}
                          checked={criticidade === opcao}
                          onChange={() => setCriticidade(opcao)}
                        />
                        <span>{opcao}</span>
                      </label>
                    ))}
                  </div>
                  <p id="explicacao-criticidade" className="sg-helper mb-0">{EXPLICACOES_CRITICIDADE[criticidade]}</p>
                  {errosCampo.criticidade && <div className="sg-erro-campo mt-2">{errosCampo.criticidade}</div>}
                </fieldset>

                <CampoTextoArea
                  rotulo="Descrição"
                  id={IDS_CAMPOS.descricao}
                  obrigatorio
                  rows={5}
                  value={descricao}
                  onChange={(e) => {
                    setDescricao(e.target.value);
                    if (errosCampo.descricao) setErrosCampo((atual) => ({ ...atual, descricao: "" }));
                  }}
                  erro={errosCampo.descricao}
                  placeholder="Ex.: Durante o chamado 123, o cadastro foi concluído sem o documento obrigatório, gerando retrabalho..."
                />
                <div className="texto-xs texto-suave text-end mb-3">{descricao.trim().length} caracteres</div>

                <Form.Group className="mb-0">
                  <Form.Label className="sg-label" htmlFor={IDS_CAMPOS.causas}>Causas</Form.Label>
                  <CampoCausas
                    idCampo={IDS_CAMPOS.causas}
                    valor={causas}
                    aoMudar={(novas) => {
                      setCausas(novas);
                      if (errosCampo.causas) setErrosCampo((atual) => ({ ...atual, causas: "" }));
                    }}
                    aoMudarPendente={(texto) => {
                      setCausaPendente(texto);
                      if (!texto && errosCampo.causas) setErrosCampo((atual) => ({ ...atual, causas: "" }));
                    }}
                    erro={errosCampo.causas}
                    sugestoes={causasConhecidas}
                    aoSolicitarCausa={usuarioQualidade ? undefined : solicitarNovaCausa}
                    linkCatalogo={usuarioQualidade}
                  />
                  <Form.Text className="sg-helper">
                    {usuarioQualidade
                      ? "Selecione causas do catálogo. Causas novas são cadastradas em Gestão de causas."
                      : "Selecione uma causa do catálogo ou solicite a inclusão de uma nova."}
                  </Form.Text>
                </Form.Group>
              </section>

              <section className="sg-cartao" aria-labelledby="abrir-passo-3">
                <div className="sg-form-nc__passo">
                  <span className="sg-form-nc__numero" aria-hidden="true">3</span>
                  <div>
                    <h2 id="abrir-passo-3" className="sg-secao-titulo mb-1">Evidências <span className="sg-texto-apoio fw-normal">opcional</span></h2>
                    <p className="sg-texto-apoio mb-0">Imagens, PDFs ou planilhas que ajudem a entender o fato.</p>
                  </div>
                </div>
                <DicaContextual
                  chave="dica_abertura_evidencias"
                  className="mb-3"
                />

                <Form.Group className="mb-1">
                  <Form.Label className="sg-label" htmlFor="evidencias-abertura">Arquivos</Form.Label>
                  <Form.Control
                    id="evidencias-abertura"
                    type="file"
                    multiple
                    accept={FORMATOS_EVIDENCIA}
                    className="sg-input"
                    onChange={selecionarArquivos}
                  />
                  <Form.Text className="sg-helper">
                    Selecione vários arquivos de uma vez ou faça novas seleções para acrescentar evidências.
                  </Form.Text>
                </Form.Group>
                {arquivosEvidencias.length > 0 && (
                  <ul className="sg-arquivos-selecionados mt-3 mb-0">
                    {arquivosEvidencias.map((arquivo, indice) => (
                      <li key={`${arquivo.name}-${arquivo.lastModified}`}>
                        <span><strong>{arquivo.name}</strong><small>{formatarTamanho(arquivo.size)}</small></span>
                        <div className="d-flex gap-2">
                          {arquivo.type.startsWith("image/") && (
                            <button className="sg-acao-arquivo sg-acao-arquivo--preview" type="button" onClick={() => setPreviewArquivo(arquivo)} disabled={enviando}>
                              Visualizar
                            </button>
                          )}
                          <button className="sg-acao-arquivo sg-acao-arquivo--remover" type="button" onClick={() => removerArquivo(indice)} disabled={enviando}>
                            Remover
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {previewArquivo && (
                  <PreviewImagem arquivo={previewArquivo} aoFechar={() => setPreviewArquivo(null)} />
                )}
              </section>
            </Form>

            <aside className="sg-cartao sg-form-nc__resumo" aria-labelledby="revisao-abrir-nc">
              <h2 id="revisao-abrir-nc" className="sg-secao-titulo">Revise antes de abrir</h2>
              <dl className="sg-form-nc__revisao">
                <div><dt>Colaborador</dt><dd>{colaboradorSelecionado?.nome || "Ainda não selecionado"}</dd></div>
                <div><dt>Setor</dt><dd>{colaboradorSelecionado?.setor || "—"}</dd></div>
                <div><dt>Criticidade</dt><dd>{criticidade}</dd></div>
                <div><dt>Causas</dt><dd>{causas.length ? causas.join(", ") : "Não informadas"}</dd></div>
                <div><dt>Evidências</dt><dd>{arquivosEvidencias.length} arquivo(s)</dd></div>
              </dl>
              <Botao type="submit" form="form-abrir-nc" variante="sucesso" carregando={enviando} tamanho="lg" className="w-100">
                {enviando ? etapaEnvio : "Abrir NC"}
              </Botao>
              <Botao
                variante="secundario"
                tamanho="lg"
                className="w-100"
                onClick={() => router.push("/")}
                disabled={enviando}
              >
                Cancelar
              </Botao>
              <p className="sg-texto-apoio mb-0">A Qualidade e a Adm recebem o aviso. Você recebe a decisão quando a NC for avaliada.</p>
            </aside>
          </div>
        )}
      </Container>
    </div>
  );
}
