import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";

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
      const nc = await abrirNc({
        chamado: chamado || null,
        colaborador_id: colaboradorId,
        criticidade,
        descricao,
        causas,
      });

      if (arquivosEvidencias.length > 0) {
        Promise.all(
          arquivosEvidencias.map((arquivo) => anexarEvidencia(nc.id, arquivo))
        ).catch((e) => console.error("Erro ao anexar evidências:", e));
      }
      navigate(`/nc/${nc.id}`);
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : "Não foi possível abrir a Não Conformidade."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container" style={{ maxWidth: "820px" }}>
        <CabecalhoPagina
          titulo="Abrir Não Conformidade"
          subtitulo="Registre uma nova não conformidade no sistema"
        />

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {carregandoDados ? (
          <EstadoCarregamento mensagem="Carregando dados do formulário..." />
        ) : (
          <div className="sg-card">
            <Form onSubmit={aoEnviar}>
              <div className="sg-secao-form">
                <h2 className="sg-secao-form__titulo">Informações da ocorrência</h2>
                <p className="sg-secao-form__descricao">
                  Identifique o chamado e o colaborador relacionado.
                </p>

                <CampoTexto
                  rotulo="Chamado"
                  value={chamado}
                  onChange={(e) => setChamado(e.target.value)}
                  placeholder="Número ou referência do chamado"
                  helper="Campo opcional. Use para relacionar a NC a um chamado do helpdesk."
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
                      {usuarios.map((u) => (
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

                <CampoSelecao
                  rotulo="Criticidade"
                  value={criticidade}
                  onChange={(e) => setCriticidade(e.target.value)}
                >
                  {OPCOES_CRITICIDADE.map((opcao) => (
                    <option key={opcao} value={opcao}>{opcao}</option>
                  ))}
                </CampoSelecao>
              </div>

              <div className="sg-secao-form">
                <h2 className="sg-secao-form__titulo">Detalhes da não conformidade</h2>
                <p className="sg-secao-form__descricao">
                  Descreva o que aconteceu e identifique possíveis causas.
                </p>

                <CampoTextoArea
                  rotulo="Descrição"
                  obrigatorio
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  erro={errosCampo.descricao}
                  placeholder="Descreva o que aconteceu..."
                />

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
                <h2 className="sg-secao-form__titulo">Evidências (opcional)</h2>
                <p className="sg-secao-form__descricao">
                  Anexe arquivos para comprovar a não conformidade.
                </p>
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
                  <Alert variant="info" className="mt-2 mb-0 py-2 px-3 small">
                    {arquivosEvidencias.length} arquivo(s) serão enviados após a criação da NC.
                  </Alert>
                )}
              </div>

              <div className="sg-secao-form d-flex gap-2">
                <Botao type="submit" variante="primario" carregando={enviando} tamanho="lg">
                  {arquivosEvidencias.length > 0
                    ? "Abrir NC e iniciar anexos..."
                    : "Abrir Não Conformidade"}
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
