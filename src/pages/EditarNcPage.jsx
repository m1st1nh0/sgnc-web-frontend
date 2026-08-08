import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";

import BarraNavegacao from "../components/BarraNavegacao";
import CampoCausas from "../components/CampoCausas";
import { buscarNc, editarNc, listarCausasConhecidas } from "../services/ncService";
import { listarUsuarios } from "../services/usuarioService";
import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import Botao from "../components/ui/Botao";
import CampoTexto from "../components/ui/CampoTexto";
import CampoSelecao from "../components/ui/CampoSelecao";
import CampoTextoArea from "../components/ui/CampoTextoArea";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import MensagemErro from "../components/ui/MensagemErro";

const OPCOES_CRITICIDADE = ["Baixa", "Média", "Alta"];

export default function EditarNcPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [chamado, setChamado] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [criticidade, setCriticidade] = useState("Baixa");
  const [descricao, setDescricao] = useState("");
  const [causas, setCausas] = useState([]);

  const [usuarios, setUsuarios] = useState([]);
  const [causasConhecidas, setCausasConhecidas] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [acesso, setAcesso] = useState(true); // false se não puder editar

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [errosCampo, setErrosCampo] = useState({});

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
        const ehAdm = usuario?.papel === "adm";
        const podeEditar = ehAdm || (ehAutor && nc.status === "aberta");

        if (!podeEditar) {
          setAcesso(false);
          setCarregandoDados(false);
          return;
        }

        setChamado(nc.chamado ?? "");
        setColaboradorId(nc.colaborador_id ?? "");
        setCriticidade(nc.criticidade ?? "Baixa");
        setDescricao(nc.descricao ?? "");
        setCausas(nc.causas ?? []);
        setUsuarios(listaUsuarios);
        setCausasConhecidas(listaCausas);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar a NC.");
      } finally {
        setCarregandoDados(false);
      }
    }
    carregar();
  }, [id, usuario]);

  const colaboradorSelecionado = usuarios.find((u) => u.id === colaboradorId);

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

    if (Object.keys(novosErros).length > 0) {
      setErrosCampo(novosErros);
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
      navigate(`/nc/${id}`);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar as alterações.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container" style={{ maxWidth: "820px" }}>
        <CabecalhoPagina
          titulo={`Editar NC #${id}`}
          subtitulo="Atualize as informações desta não conformidade"
        />

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
          <div className="sg-card">
            <Form onSubmit={aoEnviar}>
              <div className="sg-secao-form">
                <h2 className="sg-secao-form__titulo">Informações da ocorrência</h2>
                <p className="sg-secao-form__descricao">
                  Atualize os dados do chamado e do colaborador.
                </p>

                <CampoTexto
                  rotulo="Chamado"
                  value={chamado}
                  onChange={(e) => setChamado(e.target.value)}
                  placeholder="Número ou referência do chamado"
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
                          {u.nome} ({u.email})
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
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </CampoSelecao>
              </div>

              <div className="sg-secao-form">
                <h2 className="sg-secao-form__titulo">Detalhes</h2>
                <p className="sg-secao-form__descricao">
                  Descreva a situação e atualize as causas.
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
                    Digite e pressione Enter.
                  </Form.Text>
                </Form.Group>
              </div>

              <div className="sg-secao-form d-flex gap-2">
                <Botao type="submit" variante="primario" carregando={enviando} tamanho="lg">
                  Salvar alterações
                </Botao>
                <Botao
                  variante="secundario"
                  tamanho="lg"
                  onClick={() => navigate(`/nc/${id}`)}
                  disabled={enviando}
                >
                  Cancelar
                </Botao>
              </div>
            </Form>
          </div>
        ) : null}
      </Container>
    </div>
  );
}