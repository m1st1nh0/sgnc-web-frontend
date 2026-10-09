import { useEffect, useState } from "react";
import Form from "react-bootstrap/Form";

import {
  concluirPlanoAcao,
  definirCritica,
  obterPlanoAcao,
  registrarAcompanhamentoPlano,
  salvarPlanoAcao,
} from "../client/ncService.js";
import { listarOpcoesNc } from "../../users/client/usuarioService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { formatarData, formatarDataHora } from "../../../lib/utils/formato.js";
import Botao from "../../../components/ui/Botao.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";

const ETAPAS = [
  ["planejamento", "Planejamento"],
  ["em_execucao", "Execução"],
  ["em_acompanhamento", "Acompanhamento"],
];
const ROTULO_ETAPA = {
  ...Object.fromEntries(ETAPAS),
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function mensagem(e, padrao) {
  return e instanceof ErroApi ? e.message : padrao;
}

function formularioDoPlano(plano) {
  return {
    status: plano?.status && ROTULO_ETAPA[plano.status] && !["concluido", "cancelado"].includes(plano.status)
      ? plano.status
      : "planejamento",
    causa_raiz: plano?.causa_raiz || "",
    acoes: plano?.acoes || "",
    responsavel_execucao_id: plano?.responsavel_execucao_id || "",
    prazo: plano?.prazo || "",
    execucao: plano?.execucao || "",
  };
}

function Detalhe({ rotulo, children }) {
  return (
    <div className="sg-detalhe">
      <dt className="sg-detalhe__rotulo">{rotulo}</dt>
      <dd className="sg-detalhe__valor" style={{ whiteSpace: "pre-wrap" }}>{children || "-"}</dd>
    </div>
  );
}

/**
 * NC crítica e plano de ação. As permissões vêm do servidor (`permissoes`), que aplica
 * a segregação de funções: o colaborador analisado só consulta, a liderança alimenta e a
 * Qualidade marca a criticidade e verifica a eficácia.
 */
export default function PainelPlanoAcao({ nc, aoAlterarNc }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [oculto, setOculto] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [enviando, setEnviando] = useState("");
  const [motivoCritica, setMotivoCritica] = useState("");
  const [alterandoCritica, setAlterandoCritica] = useState(false);
  const [form, setForm] = useState(formularioDoPlano(null));
  const [registro, setRegistro] = useState("");
  const [verificacao, setVerificacao] = useState("");
  const [pessoas, setPessoas] = useState([]);

  function aplicar(resposta) {
    setDados(resposta);
    setForm(formularioDoPlano(resposta.plano));
  }

  useEffect(() => {
    let ativo = true;
    obterPlanoAcao(nc.id)
      .then((resposta) => { if (ativo) aplicar(resposta); })
      .catch((e) => {
        if (!ativo) return;
        // Sem permissão de leitura: o painel simplesmente não aparece.
        if (e instanceof ErroApi && [403, 404].includes(e.status)) setOculto(true);
        else setErro(mensagem(e, "Não foi possível carregar o plano de ação."));
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [nc.id, nc.status, nc.critica]);

  const podeAlimentar = !!dados?.permissoes?.alimentar_plano;
  useEffect(() => {
    if (!podeAlimentar || pessoas.length) return;
    listarOpcoesNc().then(setPessoas).catch(() => setPessoas([]));
  }, [podeAlimentar, pessoas.length]);

  async function executar(chave, acao, mensagemSucesso, alteraNc = false) {
    setErro("");
    setSucesso("");
    setEnviando(chave);
    try {
      aplicar(await acao());
      setSucesso(mensagemSucesso);
      if (alteraNc) await aoAlterarNc?.();
      return true;
    } catch (e) {
      setErro(mensagem(e, "Não foi possível atualizar o plano de ação."));
      return false;
    } finally {
      setEnviando("");
    }
  }

  async function confirmarCritica(critica) {
    if (motivoCritica.trim().length < 10) {
      setErro("Informe a justificativa com ao menos 10 caracteres.");
      return;
    }
    const ok = await executar(
      "critica",
      () => definirCritica(nc.id, critica, motivoCritica),
      critica ? "NC marcada como crítica. O plano de ação foi aberto." : "Criticidade removida e plano cancelado.",
      true,
    );
    if (ok) {
      setMotivoCritica("");
      setAlterandoCritica(false);
    }
  }

  async function registrarAcompanhamento() {
    const ok = await executar("registro", () => registrarAcompanhamentoPlano(nc.id, registro), "Acompanhamento registrado.");
    if (ok) setRegistro("");
  }

  if (oculto) return null;
  if (carregando) return <EstadoCarregamento mensagem="Carregando plano de ação..." compacto />;
  if (!dados) return erro ? <MensagemErro mensagem={erro} /> : null;

  const { plano, permissoes } = dados;
  if (!dados.critica && !plano && !permissoes.marcar_critica) return null;
  const encerrado = plano && ["concluido", "cancelado"].includes(plano.status);
  const ocupado = !!enviando;
  const campo = (chave) => ({
    value: form[chave],
    disabled: ocupado,
    onChange: (e) => setForm((atual) => ({ ...atual, [chave]: e.target.value })),
  });

  return (
    <section className="sg-painel" aria-label="NC crítica e plano de ação">
      <div className="sg-painel__cabecalho d-flex justify-content-between align-items-center gap-2 flex-wrap">
        <h2 className="sg-painel__titulo">{dados.critica ? "NC crítica · Plano de ação" : "Criticidade da NC"}</h2>
        {plano && (
          <span className={`sg-badge ${plano.status === "concluido" ? "sg-badge--verde" : plano.status === "cancelado" ? "sg-badge--cinza" : "sg-badge--vermelho"}`}>
            Plano: {ROTULO_ETAPA[plano.status] ?? plano.status}
          </span>
        )}
      </div>
      <div className="sg-painel__corpo d-flex flex-column gap-3">
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        {sucesso && <div className="sg-alerta sg-alerta--sucesso mb-0" role="status">{sucesso}</div>}

        {!dados.critica && permissoes.marcar_critica && (
          <div>
            <Form.Check
              type="switch"
              id={`nc-${nc.id}-critica`}
              label="Marcar esta NC como crítica (exclusivo da Qualidade)"
              checked={alterandoCritica}
              disabled={ocupado}
              onChange={(e) => setAlterandoCritica(e.target.checked)}
            />
            <p className="texto-xs texto-suave mt-1 mb-0">
              Uma NC crítica recebe um plano de ação. Após o aceite do colaborador, ela fica em
              &quot;Em plano de ação&quot; até a Qualidade verificar a eficácia.
            </p>
          </div>
        )}

        {dados.critica && (
          <dl className="mb-0">
            <Detalhe rotulo="Justificativa da criticidade">{dados.critica_motivo}</Detalhe>
            <Detalhe rotulo="Marcada por">
              {dados.critica_marcada_por_nome}
              {dados.critica_marcada_em ? ` em ${formatarDataHora(dados.critica_marcada_em)}` : ""}
            </Detalhe>
          </dl>
        )}

        {dados.critica && permissoes.desmarcar_critica && !alterandoCritica && (
          <div>
            <Botao variante="secundario" tamanho="sm" disabled={ocupado} onClick={() => setAlterandoCritica(true)}>
              Remover criticidade
            </Botao>
          </div>
        )}

        {alterandoCritica && (
          <div>
            <Form.Group className="mb-2">
              <Form.Label className="sg-label">
                {dados.critica ? "Justificativa para remover a criticidade *" : "Justificativa da criticidade *"}
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                className="sg-textarea"
                value={motivoCritica}
                disabled={ocupado}
                onChange={(e) => setMotivoCritica(e.target.value)}
              />
              {dados.critica && (
                <Form.Text className="texto-xs">
                  O plano será cancelado (não apagado) e a justificativa ficará no histórico.
                </Form.Text>
              )}
            </Form.Group>
            <div className="d-flex gap-2">
              <Botao
                variante={dados.critica ? "perigo" : "primario"}
                tamanho="sm"
                carregando={enviando === "critica"}
                disabled={ocupado}
                onClick={() => confirmarCritica(!dados.critica)}
              >
                {dados.critica ? "Confirmar remoção" : "Confirmar NC crítica"}
              </Botao>
              <Botao
                variante="secundario"
                tamanho="sm"
                disabled={ocupado}
                onClick={() => { setAlterandoCritica(false); setMotivoCritica(""); }}
              >
                Cancelar
              </Botao>
            </div>
          </div>
        )}

        {plano && (podeAlimentar ? (
          <div className="d-flex flex-column gap-2">
            <h3 className="h6 mb-0">Planejamento</h3>
            <Form.Group>
              <Form.Label className="sg-label">Causa raiz</Form.Label>
              <Form.Control as="textarea" rows={3} className="sg-textarea" maxLength={4000} {...campo("causa_raiz")} />
            </Form.Group>
            <Form.Group>
              <Form.Label className="sg-label">Ações planejadas (o quê, como)</Form.Label>
              <Form.Control as="textarea" rows={3} className="sg-textarea" maxLength={4000} {...campo("acoes")} />
            </Form.Group>
            <div className="d-flex gap-2 flex-wrap">
              <Form.Group className="flex-grow-1">
                <Form.Label className="sg-label">Responsável pela execução</Form.Label>
                <Form.Select className="sg-input" {...campo("responsavel_execucao_id")}>
                  <option value="">Selecione</option>
                  {pessoas.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>{pessoa.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label className="sg-label">Prazo</Form.Label>
                <Form.Control type="date" className="sg-input" {...campo("prazo")} />
              </Form.Group>
            </div>
            <h3 className="h6 mb-0 mt-2">Execução</h3>
            <Form.Group>
              <Form.Label className="sg-label">O que foi executado</Form.Label>
              <Form.Control as="textarea" rows={3} className="sg-textarea" maxLength={4000} {...campo("execucao")} />
            </Form.Group>
            <div className="d-flex gap-2 flex-wrap align-items-end">
              <Form.Group>
                <Form.Label className="sg-label">Etapa do plano</Form.Label>
                <Form.Select className="sg-input" {...campo("status")}>
                  {ETAPAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                </Form.Select>
              </Form.Group>
              <Botao
                variante="primario"
                carregando={enviando === "plano"}
                disabled={ocupado}
                onClick={() => executar("plano", () => salvarPlanoAcao(nc.id, form), "Plano de ação salvo.")}
              >
                Salvar plano
              </Botao>
            </div>
            <p className="texto-xs texto-suave mb-0">
              Para iniciar a execução, preencha causa raiz, ações, responsável e prazo. Para passar ao
              acompanhamento, descreva a execução. Toda alteração fica registrada na trilha abaixo.
            </p>
          </div>
        ) : (
          <dl className="mb-0">
            <Detalhe rotulo="Causa raiz">{plano.causa_raiz}</Detalhe>
            <Detalhe rotulo="Ações planejadas">{plano.acoes}</Detalhe>
            <Detalhe rotulo="Responsável pela execução">{plano.responsavel_execucao_nome}</Detalhe>
            <Detalhe rotulo="Prazo">{plano.prazo ? formatarData(plano.prazo) : null}</Detalhe>
            <Detalhe rotulo="Execução">{plano.execucao}</Detalhe>
            {plano.verificacao_eficacia && (
              <Detalhe rotulo="Verificação de eficácia">
                {plano.verificacao_eficacia}
                {plano.concluido_por_nome ? `\n— ${plano.concluido_por_nome}, ${formatarDataHora(plano.concluido_em)}` : ""}
              </Detalhe>
            )}
            {plano.motivo_cancelamento && <Detalhe rotulo="Motivo do cancelamento">{plano.motivo_cancelamento}</Detalhe>}
          </dl>
        ))}

        {plano && (
          <div>
            <h3 className="h6">Acompanhamento</h3>
            {dados.acompanhamentos.length === 0 ? (
              <p className="texto-sm texto-suave mb-2">Nenhum registro ainda.</p>
            ) : (
              <ol className="list-unstyled d-flex flex-column gap-2 mb-3">
                {dados.acompanhamentos.map((item) => (
                  <li
                    key={item.id}
                    className={item.tipo === "evento" ? "texto-xs texto-suave" : "sg-card p-2"}
                  >
                    <div className={item.tipo === "evento" ? "" : "texto-xs texto-suave"}>
                      {formatarDataHora(item.criado_em)} · {item.usuario_nome}
                      {item.tipo === "evento" ? ` — ${item.texto}` : ""}
                    </div>
                    {item.tipo === "registro" && <div style={{ whiteSpace: "pre-wrap" }}>{item.texto}</div>}
                  </li>
                ))}
              </ol>
            )}
            {podeAlimentar && (
              <>
                <Form.Group className="mb-2">
                  <Form.Label className="sg-label">Novo registro de acompanhamento</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    className="sg-textarea"
                    maxLength={4000}
                    value={registro}
                    disabled={ocupado}
                    onChange={(e) => setRegistro(e.target.value)}
                  />
                </Form.Group>
                <Botao
                  variante="secundario"
                  tamanho="sm"
                  carregando={enviando === "registro"}
                  disabled={ocupado || registro.trim().length < 3}
                  onClick={registrarAcompanhamento}
                >
                  Registrar acompanhamento
                </Botao>
              </>
            )}
          </div>
        )}

        {permissoes.concluir_plano && (
          <div>
            <h3 className="h6">Verificação de eficácia</h3>
            <Form.Group className="mb-2">
              <Form.Label className="sg-label">Como a eficácia foi verificada *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                className="sg-textarea"
                maxLength={4000}
                value={verificacao}
                disabled={ocupado}
                onChange={(e) => setVerificacao(e.target.value)}
              />
            </Form.Group>
            <Botao
              variante="sucesso"
              carregando={enviando === "concluir"}
              disabled={ocupado || verificacao.trim().length < 10}
              onClick={() => executar("concluir", () => concluirPlanoAcao(nc.id, verificacao), "Plano concluído e NC encerrada.", true)}
            >
              Verificar eficácia e concluir
            </Botao>
          </div>
        )}

        {dados.critica && !encerrado && !podeAlimentar && !permissoes.concluir_plano && (
          <p className="texto-xs texto-suave mb-0">
            Você acompanha este plano em modo de consulta. Ele é alimentado pela Qualidade e pela
            liderança do colaborador analisado.
          </p>
        )}
      </div>
    </section>
  );
}
