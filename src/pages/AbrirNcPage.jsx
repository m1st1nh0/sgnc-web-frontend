import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import BarraNavegacao from "../components/BarraNavegacao";
import CampoCausas from "../components/CampoCausas";
import { listarOpcoesNc } from "../services/usuarioService";
import { ErroApi } from "../services/api";
import { abrirNc, listarCausasConhecidas, anexarEvidencia } from "../services/ncService";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import Botao from "../components/ui/Botao";
import CampoTexto from "../components/ui/CampoTexto";
import CampoSelecao from "../components/ui/CampoSelecao";
import CampoTextoArea from "../components/ui/CampoTextoArea";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import MensagemErro from "../components/ui/MensagemErro";

const OPCOES_CRITICIDADE = ["Baixa", "Média", "Alta"];
const EXPLICACOES_CRITICIDADE = {
  Baixa: "Baixo impacto e sem interrupção relevante da operação.",
  Média: "Impacto perceptível, retrabalho ou risco moderado para a operação.",
  Alta: "Impacto grave, interrupção ou risco elevado que exige prioridade.",
};

function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export default function AbrirNcPage() {
  const navigate = useNavigate();

  const [chamado, setChamado] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [criticidade, setCriticidade] = useState("Baixa");
  const [descricao, setDescricao] = useState("");
  const [causas, setCausas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [causasConhecidas, setCausasConhecidas] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [errosCampo, setErrosCampo] = useState({});
  const [arquivosEvidencias, setArquivosEvidencias] = useState([]);
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [etapaEnvio, setEtapaEnvio] = useState("");

  useEffect(() => {
    async function carregarDadosDeApoio() {
      try {
        const [listaUsuarios, listaCausas] = await Promise.all([
          listarOpcoesNc(),
          listarCausasConhecidas(),
        ]);
        setUsuarios(listaUsuarios);
        setCausasConhecidas(listaCausas);
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
  }, []);

  const colaboradorSelecionado = usuarios.find((u) => u.id === colaboradorId);
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
    setArquivosEvidencias((atuais) => atuais.filter((_, i) => i !== indice));
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
    if (Object.keys(novosErros).length > 0) {
      setErrosCampo(novosErros);
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
        await Promise.all(
          arquivosEvidencias.map((arquivo) => anexarEvidencia(nc.id, arquivo))
        );
      }
      navigate(`/nc/${nc.id}`);
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : "Não foi possível abrir a Não Conformidade."
      );
    } finally {
      setEnviando(false);
      setEtapaEnvio("");
    }
  }

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container" style={{ maxWidth: "820px" }}>
        <CabecalhoPagina
          titulo="Abrir Não Conformidade"
          subtitulo="Registre o fato com clareza. A equipe responsável fará a avaliação depois."
        />

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {carregandoDados ? (
          <EstadoCarregamento mensagem="Carregando dados do formulário..." />
        ) : (
          <div className="sg-card">
            <Form onSubmit={aoEnviar}>
              <div className="sg-secao-form">
                <div className="sg-etapa-form">
                  <span className="sg-etapa-form__numero">1</span>
                  <div>
                    <h2 className="sg-secao-form__titulo">Quem e onde</h2>
                    <p className="sg-secao-form__descricao">
                      Localize o colaborador ativo e confira o setor antes de continuar.
                    </p>
                  </div>
                </div>

                <CampoTexto
                  rotulo="Chamado"
                  value={chamado}
                  onChange={(e) => setChamado(e.target.value)}
                  placeholder="Número ou referência do chamado"
                  helper="Campo opcional. Use para relacionar a NC a um chamado do helpdesk."
                />

                <CampoTexto
                  rotulo="Buscar colaborador"
                  value={buscaColaborador}
                  onChange={(e) => setBuscaColaborador(e.target.value)}
                  placeholder="Digite o nome ou setor"
                  helper={`${usuariosFiltrados.length} de ${usuarios.length} colaborador(es) disponível(is)`}
                />

                <Row>
                  <Col md={8}>
                    <CampoSelecao
                      rotulo="Colaborador analisado"
                      obrigatorio
                      value={colaboradorId}
                      onChange={(e) => setColaboradorId(e.target.value)}
                      erro={errosCampo.colaborador}
                    >
                      <option value="">Selecione...</option>
                      {usuariosFiltrados.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}{u.setor ? ` — ${u.setor}` : ""}
                        </option>
                      ))}
                    </CampoSelecao>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label className="sg-label">Setor</Form.Label>
                      <Form.Control
                        type="text"
                        className="sg-input"
                        value={colaboradorSelecionado?.setor || ""}
                        readOnly
                        disabled
                        placeholder="Definido pelo cadastro"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {colaboradorSelecionado && (
                  <div className="sg-resumo-selecao mb-3" role="status">
                    <span>Selecionado</span>
                    <strong>{colaboradorSelecionado.nome}</strong>
                    <small>{colaboradorSelecionado.setor || "Setor não informado"}</small>
                  </div>
                )}

                <CampoSelecao
                  rotulo="Criticidade"
                  value={criticidade}
                  onChange={(e) => setCriticidade(e.target.value)}
                >
                  {OPCOES_CRITICIDADE.map((opcao) => (
                    <option key={opcao} value={opcao}>{opcao}</option>
                  ))}
                </CampoSelecao>
                <p className="sg-helper mt-n2">{EXPLICACOES_CRITICIDADE[criticidade]}</p>
              </div>

              <div className="sg-secao-form">
                <div className="sg-etapa-form">
                  <span className="sg-etapa-form__numero">2</span>
                  <div>
                    <h2 className="sg-secao-form__titulo">O que aconteceu</h2>
                    <p className="sg-secao-form__descricao">
                      Informe fatos observáveis, impacto e contexto. Evite julgamentos pessoais.
                    </p>
                  </div>
                </div>

                <CampoTextoArea
                  rotulo="Descrição"
                  obrigatorio
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  erro={errosCampo.descricao}
                  placeholder="Ex.: Durante o chamado 123, o cadastro foi concluído sem o documento obrigatório, gerando retrabalho..."
                />
                <div className="texto-xs texto-suave text-end mb-3">{descricao.trim().length} caracteres</div>

                <Form.Group className="mb-4">
                  <Form.Label className="sg-label">Causas</Form.Label>
                  <CampoCausas
                    valor={causas}
                    aoMudar={setCausas}
                    sugestoes={causasConhecidas}
                  />
                  <Form.Text className="sg-helper">
                    Digite e pressione Enter. Causas novas são adicionadas à lista automaticamente.
                  </Form.Text>
                </Form.Group>
              </div>

              <div className="sg-secao-form">
                <div className="sg-etapa-form">
                  <span className="sg-etapa-form__numero">3</span>
                  <div>
                    <h2 className="sg-secao-form__titulo">Evidências e revisão</h2>
                    <p className="sg-secao-form__descricao">
                      Anexe arquivos úteis e confira o resumo antes de registrar.
                    </p>
                  </div>
                </div>
                <Form.Group className="mb-1">
                  <Form.Control
                    type="file"
                    multiple
                    className="sg-input"
                    onChange={(e) => setArquivosEvidencias(Array.from(e.target.files || []))}
                  />
                  <Form.Text className="sg-helper">
                    Você pode selecionar uma ou mais evidências antes de abrir a NC.
                  </Form.Text>
                </Form.Group>
                {arquivosEvidencias.length > 0 && (
                  <ul className="sg-arquivos-selecionados mt-3 mb-0">
                    {arquivosEvidencias.map((arquivo, indice) => (
                      <li key={`${arquivo.name}-${arquivo.lastModified}`}>
                        <span><strong>{arquivo.name}</strong><small>{formatarTamanho(arquivo.size)}</small></span>
                        <button type="button" onClick={() => removerArquivo(indice)} disabled={enviando}>
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="sg-revisao-nc mt-4">
                  <h3>Revise antes de abrir</h3>
                  <dl>
                    <div><dt>Colaborador</dt><dd>{colaboradorSelecionado?.nome || "Ainda não selecionado"}</dd></div>
                    <div><dt>Setor</dt><dd>{colaboradorSelecionado?.setor || "—"}</dd></div>
                    <div><dt>Criticidade</dt><dd>{criticidade}</dd></div>
                    <div><dt>Causas</dt><dd>{causas.length ? causas.join(", ") : "Não informadas"}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="sg-secao-form d-flex gap-2">
                <Botao type="submit" variante="primario" carregando={enviando} tamanho="lg">
                  {enviando ? etapaEnvio : "Abrir Não Conformidade"}
                </Botao>
                <Botao
                  variante="secundario"
                  tamanho="lg"
                  onClick={() => navigate("/")}
                  disabled={enviando}
                >
                  Cancelar
                </Botao>
              </div>
            </Form>
          </div>
        )}
      </Container>
    </div>
  );
}
