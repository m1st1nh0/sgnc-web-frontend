import { useEffect, useState } from "react";
import Form from "react-bootstrap/Form";

import {
  abrirPlanoAcao,
  concluirPlanoAcao,
  decidirEscalonamento,
  decidirNaoEficaz,
  definirCritica,
  registrarVerificacao,
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
  // Fase 5 do processo: plano em NC não crítica, verificação de eficácia e escalonamento.
  const [motivoPlano, setMotivoPlano] = useState("");
  const [abrindoPlano, setAbrindoPlano] = useState(false);
  const [resultado, setResultado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [decisao, setDecisao] = useState("");
  const [motivoDecisao, setMotivoDecisao] = useState("");
  const [parecer, setParecer] = useState("");
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
      critica ? "NC marcada como crítica. O plano de ação foi aberto."
        : dados?.plano_acao_aberto ? "Criticidade removida. O plano de ação continua." : "Criticidade removida e plano cancelado.",
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
  const comPlano = dados.critica || dados.plano_acao_aberto;
  const etapaVerificacao = ["em_verificacao", "nao_eficaz", "escalada"].includes(dados.status_nc)
    || !!dados.verificacao?.resultado || !!dados.escalonamento;
  if (!comPlano && !plano && !permissoes.marcar_critica && !permissoes.abrir_plano && !etapaVerificacao) return null;
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
        <h2 className="sg-painel__titulo">
          {dados.critica ? "NC crítica · Plano de ação" : comPlano ? "Plano de ação" : "Criticidade e plano de ação"}
        </h2>
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

        {permissoes.abrir_plano && !abrindoPlano && (
          <div>
            <Botao variante="secundario" tamanho="sm" disabled={ocupado} onClick={() => setAbrindoPlano(true)}>
              Abrir plano de ação
            </Botao>
            <p className="texto-xs texto-suave mt-1 mb-0">
              Opcional na NC não crítica. Depois do aceite, a NC fica em &quot;Em plano de ação&quot; e, ao concluir o
              plano, passa pela verificação de eficácia em 30 dias.
            </p>
          </div>
        )}
        {abrindoPlano && (
          <div>
            <Form.Group className="mb-2" controlId={`nc-${nc.id}-motivo-plano`}>
              <Form.Label className="sg-label">Por que abrir um plano de ação nesta NC? *</Form.Label>
              <Form.Control as="textarea" rows={2} className="sg-textarea" maxLength={1000} value={motivoPlano}
                disabled={ocupado} onChange={(e) => setMotivoPlano(e.target.value)} />
            </Form.Group>
            <div className="d-flex gap-2">
              <Botao variante="primario" tamanho="sm" carregando={enviando === "abrir"} disabled={ocupado || motivoPlano.trim().length < 10}
                onClick={async () => {
                  if (await executar("abrir", () => abrirPlanoAcao(nc.id, motivoPlano), "Plano de ação aberto.", true)) {
                    setAbrindoPlano(false);
                    setMotivoPlano("");
                  }
                }}>
                Confirmar plano de ação
              </Botao>
              <Botao variante="secundario" tamanho="sm" disabled={ocupado} onClick={() => { setAbrindoPlano(false); setMotivoPlano(""); }}>
                Cancelar
              </Botao>
            </div>
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
                  {dados.plano_acao_aberto
                    ? "O plano de ação continua; a justificativa ficará no histórico."
                    : "O plano será cancelado (não apagado) e a justificativa ficará no histórico."}
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
              <Detalhe rotulo="Conclusão do plano">
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
            <h3 className="h6">Concluir o plano</h3>
            <Form.Group className="mb-2">
              <Form.Label className="sg-label">O que foi entregue pelo plano *</Form.Label>
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
              onClick={() => executar("concluir", () => concluirPlanoAcao(nc.id, verificacao), "Plano concluído. A verificação de eficácia vai até daqui a 30 dias.", true)}
            >
              Concluir plano e iniciar a verificação
            </Botao>
            <p className="texto-xs texto-suave mt-1 mb-0">
              A NC fica &quot;Em verificação&quot; por 30 dias; depois a Qualidade registra se o plano foi eficaz.
            </p>
          </div>
        )}

        {etapaVerificacao && (
          <div>
            <h3 className="h6">Verificação de eficácia</h3>
            <dl className="mb-2">
              {dados.verificacao?.inicio && (
                <Detalhe rotulo="Janela de verificação">
                  {`${formatarData(dados.verificacao.inicio)} a ${formatarData(dados.verificacao.ate)}`}
                </Detalhe>
              )}
              {dados.verificacao?.resultado && (
                <Detalhe rotulo="Resultado">
                  {dados.verificacao.resultado === "eficaz" ? "Eficaz" : "Não eficaz"}
                  {dados.verificacao.observacao ? `: ${dados.verificacao.observacao}` : ""}
                  {dados.verificacao.registrada_por_nome ? `\n— ${dados.verificacao.registrada_por_nome}, ${formatarDataHora(dados.verificacao.registrada_em)}` : ""}
                </Detalhe>
              )}
              {dados.escalonamento && (
                <>
                  <Detalhe rotulo="Escalada para">
                    {`${dados.escalonamento.gestor_nome} (gestor do departamento)`}
                    {dados.escalonamento.motivo ? `\nMotivo: ${dados.escalonamento.motivo}` : ""}
                  </Detalhe>
                  {dados.escalonamento.parecer && (
                    <Detalhe rotulo="Parecer do gestor">
                      {dados.escalonamento.parecer}
                      {dados.escalonamento.decidido_em ? `\n— ${formatarDataHora(dados.escalonamento.decidido_em)}` : ""}
                    </Detalhe>
                  )}
                </>
              )}
            </dl>

            {permissoes.registrar_verificacao && (
              <div>
                <Form.Group className="mb-2">
                  <Form.Label className="sg-label d-block">O plano foi eficaz? *</Form.Label>
                  <Form.Check inline type="radio" id={`nc-${nc.id}-eficaz`} name={`nc-${nc.id}-resultado`} label="Eficaz (concluir a NC)"
                    checked={resultado === "eficaz"} disabled={ocupado} onChange={() => setResultado("eficaz")} />
                  <Form.Check inline type="radio" id={`nc-${nc.id}-nao-eficaz`} name={`nc-${nc.id}-resultado`} label="Não eficaz"
                    checked={resultado === "nao_eficaz"} disabled={ocupado} onChange={() => setResultado("nao_eficaz")} />
                </Form.Group>
                <Form.Group className="mb-2" controlId={`nc-${nc.id}-obs-verificacao`}>
                  <Form.Label className="sg-label">{resultado === "nao_eficaz" ? "Por que não foi eficaz? *" : "Observação (opcional)"}</Form.Label>
                  <Form.Control as="textarea" rows={2} className="sg-textarea" maxLength={4000} value={observacao}
                    disabled={ocupado} onChange={(e) => setObservacao(e.target.value)} />
                </Form.Group>
                <Botao variante="primario" tamanho="sm" carregando={enviando === "verificacao"}
                  disabled={ocupado || !resultado || (resultado === "nao_eficaz" && observacao.trim().length < 10)}
                  onClick={() => executar("verificacao", () => registrarVerificacao(nc.id, resultado, observacao),
                    resultado === "eficaz" ? "Plano eficaz. NC concluída." : "Plano não eficaz. Decida se a NC será reaberta ou escalada.", true)}>
                  Registrar verificação
                </Botao>
              </div>
            )}

            {permissoes.decidir_nao_eficaz && (
              <div>
                <Form.Group className="mb-2">
                  <Form.Label className="sg-label d-block">O que fazer com a NC não eficaz? *</Form.Label>
                  <Form.Check type="radio" id={`nc-${nc.id}-reabrir`} name={`nc-${nc.id}-decisao`} label="Reabrir: nova rodada do plano de ação"
                    checked={decisao === "reabrir"} disabled={ocupado} onChange={() => setDecisao("reabrir")} />
                  <Form.Check type="radio" id={`nc-${nc.id}-escalar`} name={`nc-${nc.id}-decisao`} label="Escalar ao gestor do departamento do colaborador"
                    checked={decisao === "escalar"} disabled={ocupado} onChange={() => setDecisao("escalar")} />
                </Form.Group>
                <Form.Group className="mb-2" controlId={`nc-${nc.id}-motivo-decisao`}>
                  <Form.Label className="sg-label">Motivo *</Form.Label>
                  <Form.Control as="textarea" rows={2} className="sg-textarea" maxLength={4000} value={motivoDecisao}
                    disabled={ocupado} onChange={(e) => setMotivoDecisao(e.target.value)} />
                </Form.Group>
                <Botao variante="primario" tamanho="sm" carregando={enviando === "decisao"}
                  disabled={ocupado || !decisao || motivoDecisao.trim().length < 10}
                  onClick={() => executar("decisao", () => decidirNaoEficaz(nc.id, decisao, motivoDecisao),
                    decisao === "reabrir" ? "NC reaberta para uma nova rodada do plano." : "NC escalada ao gestor do departamento.", true)}>
                  Confirmar decisão
                </Botao>
              </div>
            )}

            {permissoes.decidir_escalonamento && (
              <div>
                <Form.Group className="mb-2" controlId={`nc-${nc.id}-parecer`}>
                  <Form.Label className="sg-label">Seu parecer (encerra a NC) *</Form.Label>
                  <Form.Control as="textarea" rows={3} className="sg-textarea" maxLength={4000} value={parecer}
                    disabled={ocupado} onChange={(e) => setParecer(e.target.value)} />
                </Form.Group>
                <Botao variante="primario" tamanho="sm" carregando={enviando === "parecer"} disabled={ocupado || parecer.trim().length < 10}
                  onClick={() => executar("parecer", () => decidirEscalonamento(nc.id, parecer), "Parecer registrado. NC encerrada.", true)}>
                  Registrar parecer
                </Botao>
              </div>
            )}
          </div>
        )}

        {comPlano && !encerrado && !podeAlimentar && !permissoes.concluir_plano && (
          <p className="texto-xs texto-suave mb-0">
            Você acompanha este plano em modo de consulta. Ele é alimentado pela Qualidade e pela
            liderança do colaborador analisado.
          </p>
        )}
      </div>
    </section>
  );
}
