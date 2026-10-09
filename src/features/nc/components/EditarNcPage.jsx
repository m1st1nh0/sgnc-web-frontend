"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";

import CampoCausas from "./CampoCausas.jsx";
import { buscarNc, editarNc, listarCausasConhecidas, solicitarCausa } from "../client/ncService.js";
import { listarUsuarios } from "../../users/client/usuarioService.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import Botao from "../../../components/ui/Botao.jsx";
import CampoTexto from "../../../components/ui/CampoTexto.jsx";
import CampoSelecao from "../../../components/ui/CampoSelecao.jsx";
import CampoTextoArea from "../../../components/ui/CampoTextoArea.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { ehQualidade } from "../../../lib/auth/papeis.js";

const OPCOES_CRITICIDADE = ["Baixa", "Média", "Alta"];

export default function EditarNcPage() {
  const { id } = useParams();
  const router = useRouter();
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
  const [avisoCausa, setAvisoCausa] = useState("");
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
        const ehAdm = ehQualidade(usuario?.papel) && nc.colaborador_id !== usuario?.id;
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
  async function solicitarNovaCausa(dados) {
    await solicitarCausa(dados);
    setAvisoCausa("Solicitação enviada. A causa ficará disponível após aprovação da Qualidade.");
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
      router.push(`/nc/${id}`);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar as alterações.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
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
        {avisoCausa && <Alert variant="success" role="status">{avisoCausa}</Alert>}

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
                    aoSolicitarCausa={solicitarNovaCausa}
                    permitirCriacaoDireta={ehQualidade(usuario?.papel)}
                  />
                  <Form.Text className="sg-helper">
                    Selecione uma causa aprovada ou solicite a inclusão de uma nova.
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
                  onClick={() => router.push(`/nc/${id}`)}
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
