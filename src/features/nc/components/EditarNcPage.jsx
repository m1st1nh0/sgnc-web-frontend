"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";

import CampoCausas from "./CampoCausas.jsx";
import { focarPrimeiroErro, resumoErros } from "../client/errosFormulario.js";

const IDS_CAMPOS = {
  colaborador: "colaborador-nc",
  descricao: "descricao-nc",
  causas: "campo-causas",
};
import { buscarNc, editarNc, listarCausasConhecidas } from "../client/ncService.js";
import { listarUsuarios } from "../../users/client/usuarioService.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import Botao from "../../../components/ui/Botao.jsx";
import CampoTexto from "../../../components/ui/CampoTexto.jsx";
import CampoSelecao from "../../../components/ui/CampoSelecao.jsx";
import CampoTextoArea from "../../../components/ui/CampoTextoArea.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { ehQualidade } from "../../../lib/auth/papeis.js";
import { limparRascunho, useRascunho } from "../../../lib/utils/rascunho.js";

const OPCOES_CRITICIDADE = ["Baixa", "Média", "Alta"];

export default function EditarNcPage() {
  const { id } = useParams();
  const router = useRouter();
  const { usuario } = useAuth();

  const [chamado, setChamado, baseChamado] = useRascunho(`editar-nc:${id}`, "chamado", "");
  const [colaboradorId, setColaboradorId, baseColaboradorId] = useRascunho(`editar-nc:${id}`, "colaboradorId", "");
  const [criticidade, setCriticidade, baseCriticidade] = useRascunho(`editar-nc:${id}`, "criticidade", "Baixa");
  const [descricao, setDescricao, baseDescricao] = useRascunho(`editar-nc:${id}`, "descricao", "");
  const [causas, setCausas, baseCausas] = useRascunho(`editar-nc:${id}`, "causas", []);

  const [usuarios, setUsuarios] = useState([]);
  const [causasConhecidas, setCausasConhecidas] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [acesso, setAcesso] = useState(true); // false se não puder editar

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [errosCampo, setErrosCampo] = useState({});
  const [causaPendente, setCausaPendente] = useRascunho(`editar-nc:${id}`, "causaPendente", "");

  useEffect(() => {
    async function carregar() {
      try {
        const [nc, listaUsuarios, listaCausas] = await Promise.all([
          buscarNc(id),
          listarUsuarios(),
          listarCausasConhecidas(),
        ]);

        // Verifica permissão: autor enquanto aberta, ou ADM qualquer status
        const ehAutor = nc.aberto_por === usuario?.id;
        const ehAdm = ehQualidade(usuario?.papel) && nc.colaborador_id !== usuario?.id;
        const podeEditar = ehAdm || (ehAutor && nc.status === "aberta");

        if (!podeEditar) {
          setAcesso(false);
          setCarregandoDados(false);
          return;
        }

        baseChamado(nc.chamado ?? "");
        baseColaboradorId(nc.colaborador_id ?? "");
        baseCriticidade(nc.criticidade ?? "Baixa");
        baseDescricao(nc.descricao ?? "");
        baseCausas(nc.causas ?? []);
        setUsuarios(listaUsuarios);
        setCausasConhecidas(listaCausas);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar a NC.");
      } finally {
        setCarregandoDados(false);
      }
    }
    carregar();
  }, [id, usuario, baseChamado, baseColaboradorId, baseCriticidade, baseDescricao, baseCausas]);

  useEffect(() => {
    // Causas cadastradas em Gestão de causas (outra aba) aparecem ao voltar para o formulário.
    function atualizarCatalogo() {
      listarCausasConhecidas().then(setCausasConhecidas).catch(() => {});
    }
    window.addEventListener("focus", atualizarCatalogo);
    return () => window.removeEventListener("focus", atualizarCatalogo);
  }, []);

  const colaboradorSelecionado = usuarios.find((u) => u.id === colaboradorId);

  function mostrarErrosCampo(erros, mensagemTopo) {
    setErrosCampo(erros);
    setErro(mensagemTopo || resumoErros(erros));
    focarPrimeiroErro(erros, IDS_CAMPOS);
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");
    setErrosCampo({});

    const novosErros = {};
    if (!colaboradorId) {
      novosErros.colaborador = "Selecione o colaborador.";
    }
    if (!descricao.trim()) {
      novosErros.descricao = "Preencha a descrição.";
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
      await editarNc(id, {
        chamado: chamado || null,
        colaborador_id: colaboradorId,
        criticidade,
        descricao,
        causas,
      });
      limparRascunho(`editar-nc:${id}`);
      router.push(`/nc/${id}`);
    } catch (e) {
      if (e instanceof ErroApi && e.campo && IDS_CAMPOS[e.campo]) {
        mostrarErrosCampo({ [e.campo]: e.message }, `As alterações não foram salvas. ${resumoErros({ [e.campo]: e.message })}`);
      } else {
        setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar as alterações.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <Container className="sg-container sg-form-nc">
        <Link href={`/nc/${id}`} className="sg-voltar">&larr; NC #{id}</Link>
        <header className="sg-pagina-cabecalho">
          <div className="sg-pagina-cabecalho__texto">
            <h1>Editar NC #{id}</h1>
            <p>Atualize as informações desta não conformidade enquanto ela aguarda avaliação.</p>
          </div>
        </header>

        {!acesso && (
          <Alert variant="warning" className="sg-alerta sg-alerta--atencao">
            Você não tem permissão para editar esta NC (só é possível enquanto ela está
            em "aberta" e você for o autor, ou se for ADM).
          </Alert>
        )}

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {carregandoDados ? (
          <EstadoCarregamento mensagem="Carregando não conformidade..." />
        ) : acesso ? (
          <div className="sg-form-nc__grade">
            <Form id="form-editar-nc" onSubmit={aoEnviar} className="sg-form-nc__secoes">
              <section className="sg-cartao" aria-labelledby="editar-passo-1">
                <div className="sg-form-nc__passo">
                  <span className="sg-form-nc__numero" aria-hidden="true">1</span>
                  <div>
                    <h2 id="editar-passo-1" className="sg-secao-titulo mb-1">Quem e onde</h2>
                    <p className="sg-texto-apoio mb-0">Atualize os dados do chamado e do colaborador.</p>
                  </div>
                </div>

                <div className="sg-form-nc__linha">
                  <div className="sg-form-nc__campo-largo">
                    <CampoSelecao
                      rotulo="Colaborador analisado"
                      id={IDS_CAMPOS.colaborador}
                      obrigatorio
                      value={colaboradorId}
                      onChange={(e) => setColaboradorId(e.target.value)}
                      erro={errosCampo.colaborador}
                    >
                      <option value="">Selecione...</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome} ({u.email})
                        </option>
                      ))}
                    </CampoSelecao>
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="sg-label" htmlFor="setor-colaborador">Setor</Form.Label>
                    <Form.Control
                      id="setor-colaborador"
                      type="text"
                      className="sg-input"
                      value={colaboradorSelecionado?.setor || ""}
                      readOnly
                      disabled
                      placeholder="Definido pelo cadastro"
                    />
                  </Form.Group>
                </div>

                <CampoTexto
                  rotulo="Chamado"
                  value={chamado}
                  onChange={(e) => setChamado(e.target.value)}
                  placeholder="Número ou referência do chamado"
                />
              </section>

              <section className="sg-cartao" aria-labelledby="editar-passo-2">
                <div className="sg-form-nc__passo">
                  <span className="sg-form-nc__numero" aria-hidden="true">2</span>
                  <div>
                    <h2 id="editar-passo-2" className="sg-secao-titulo mb-1">O que aconteceu</h2>
                    <p className="sg-texto-apoio mb-0">Descreva a situação e atualize as causas.</p>
                  </div>
                </div>

                <fieldset className="sg-segmentado">
                  <legend className="sg-label">Criticidade</legend>
                  <div className="sg-segmentado__opcoes">
                    {OPCOES_CRITICIDADE.map((opcao) => (
                      <label key={opcao} className="sg-segmentado__opcao">
                        <input
                          type="radio"
                          name="criticidade"
                          value={opcao}
                          checked={criticidade === opcao}
                          onChange={() => setCriticidade(opcao)}
                        />
                        <span>{opcao}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <CampoTextoArea
                  rotulo="Descrição"
                  id={IDS_CAMPOS.descricao}
                  obrigatorio
                  rows={5}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  erro={errosCampo.descricao}
                  placeholder="Descreva o que aconteceu..."
                />

                <Form.Group className="mb-0">
                  <Form.Label className="sg-label" htmlFor={IDS_CAMPOS.causas}>Causas</Form.Label>
                  <CampoCausas
                    idCampo={IDS_CAMPOS.causas}
                    valor={causas}
                    aoMudar={setCausas}
                    aoMudarPendente={setCausaPendente}
                    erro={errosCampo.causas}
                    sugestoes={causasConhecidas}
                    linkCatalogo
                  />
                  <Form.Text className="sg-helper">
                    Selecione causas do catálogo. Causas novas são cadastradas em Gestão de causas.
                  </Form.Text>
                </Form.Group>
              </section>
            </Form>

            <aside className="sg-cartao sg-form-nc__resumo" aria-labelledby="revisao-editar-nc">
              <h2 id="revisao-editar-nc" className="sg-secao-titulo">Revise as alterações</h2>
              <dl className="sg-form-nc__revisao">
                <div><dt>Colaborador</dt><dd>{colaboradorSelecionado?.nome || "Ainda não selecionado"}</dd></div>
                <div><dt>Setor</dt><dd>{colaboradorSelecionado?.setor || "—"}</dd></div>
                <div><dt>Criticidade</dt><dd>{criticidade}</dd></div>
                <div><dt>Causas</dt><dd>{causas.length ? causas.join(", ") : "Não informadas"}</dd></div>
              </dl>
              <Botao type="submit" form="form-editar-nc" variante="sucesso" carregando={enviando} tamanho="lg" className="w-100">
                Salvar alterações
              </Botao>
              <Botao
                variante="secundario"
                tamanho="lg"
                className="w-100"
                onClick={() => router.push(`/nc/${id}`)}
                disabled={enviando}
              >
                Cancelar
              </Botao>
            </aside>
          </div>
        ) : null}
      </Container>
    </div>
  );
}
