import { useEffect, useState } from "react";
import Form from "react-bootstrap/Form";
import Link from "next/link";

import { aplicarFeedback, anexarEvidencia, obterReincidencia } from "../client/ncService.js";
import { infoDoStatus } from "../client/statusNc.js";
import { ROTULOS_CAMPO_FEEDBACK, focarPrimeiroErro, resumoErros } from "../client/errosFormulario.js";
import { listarOpcoesNc } from "../../users/client/usuarioService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { formatarData, formatarPrazo } from "../../../lib/utils/formato.js";
import Botao from "../../../components/ui/Botao.jsx";
import CampoSelecao from "../../../components/ui/CampoSelecao.jsx";
import CampoTexto from "../../../components/ui/CampoTexto.jsx";
import CampoTextoArea from "../../../components/ui/CampoTextoArea.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { limparRascunho, useRascunho } from "../../../lib/utils/rascunho.js";

const IDS_CAMPOS = {
  causa_raiz: "feedback-causa-raiz",
  acao_combinada: "feedback-acao",
  responsavel_acao: "feedback-responsavel",
  prazo_acao: "feedback-prazo",
  combinado: "feedback-combinado",
  resumo_conversa: "feedback-resumo",
  participantes: "feedback-participantes",
};
const FORMATOS_ANEXO = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xlsx";
const ROTULO_ACEITE = {
  aguardando: "aguardando aceite",
  no_prazo: "aceito no prazo",
  fora_prazo: "aceito fora do prazo",
  nao_respondida: "não respondida",
  sem_feedback: "sem feedback",
};

function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function validar(campos) {
  const erros = {};
  if (!campos.causa_raiz.trim()) erros.causa_raiz = "Informe a causa raiz.";
  if (!campos.acao_combinada.trim()) erros.acao_combinada = "Informe a ação combinada.";
  if (!campos.responsavel_acao_id) erros.responsavel_acao = "Escolha o responsável pela ação.";
  if (!campos.prazo_acao) erros.prazo_acao = "Informe o prazo da ação.";
  else if (campos.prazo_acao < hojeEmSaoPaulo()) erros.prazo_acao = "O prazo da ação não pode ser anterior a hoje.";
  if (!campos.combinado.trim()) erros.combinado = "Informe o que foi combinado com o colaborador.";
  if (!campos.resumo_conversa.trim()) erros.resumo_conversa = "Resuma a conversa com o colaborador.";
  return erros;
}

/** Histórico do colaborador com as causas desta NC nos últimos 12 meses. */
function HistoricoReincidencia({ ncId, orientativa = false }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    obterReincidencia(ncId)
      .then((resultado) => { if (ativo) setDados(resultado); })
      .catch((e) => { if (ativo) setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar o histórico do colaborador."); });
    return () => { ativo = false; };
  }, [ncId]);

  return (
    <section className="sg-reincidencia mb-3" aria-labelledby={`reincidencia-${ncId}`}>
      <h3 id={`reincidencia-${ncId}`} className="sg-reincidencia__titulo">Histórico deste colaborador com esta causa</h3>
      {erro && <p className="texto-sm mb-0">{erro}</p>}
      {!erro && !dados && <p className="texto-sm texto-secundario mb-0">Carregando histórico...</p>}
      {dados && (
        <>
          <ul className="sg-reincidencia__ocorrencias">
            {dados.ocorrencias.map((item) => (
              <li key={item.causa}>
                <strong>{item.causa}:</strong>{" "}
                {orientativa ? "não conta (NC orientativa)" : item.ocorrencia_numero ? `${item.ocorrencia_numero}ª NC da causa no ciclo de 12 meses` : "ocorrência não calculada"}
              </li>
            ))}
          </ul>
          {dados.anteriores.length === 0 ? (
            <p className="texto-sm texto-secundario mb-0">Nenhuma NC anterior com estas causas nos últimos 12 meses.</p>
          ) : (
            <ol className="sg-reincidencia__lista">
              {dados.anteriores.map((anterior) => (
                <li key={anterior.id}>
                  <Link href={`/nc/${anterior.id}`} target="_blank" rel="noopener">NC #{anterior.id}</Link>
                  {" · "}{formatarData(anterior.data)}{" · "}{infoDoStatus(anterior.status).rotulo}{" · "}{ROTULO_ACEITE[anterior.aceite]}
                  <div className="texto-xs texto-secundario">{anterior.causas.join(", ")}</div>
                  {anterior.acao_combinada && (
                    <div className="texto-xs">
                      <strong>Causa raiz:</strong> {anterior.causa_raiz} · <strong>Ação:</strong> {anterior.acao_combinada}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Exibido para a Qualidade (sem conflito) quando a NC está aguardando feedback.
 * Todos os campos são obrigatórios, exceto os anexos (D3).
 */
export default function PainelFeedback({ nc, aoConcluir }) {
  // Com análise de causa registrada (Fase 3), a causa raiz vem dela e não é editada aqui.
  const causaDaAnalise = nc.analise_causa || "";
  const [campos, setCampos] = useRascunho(`feedback-nc:${nc.id}`, "campos", {
    causa_raiz: causaDaAnalise, acao_combinada: "", responsavel_acao_id: "", prazo_acao: "", combinado: "",
    resumo_conversa: "", participantes: [], liberar_posicionamento: false,
  });
  const [participanteEscolhido, setParticipanteEscolhido] = useRascunho(`feedback-nc:${nc.id}`, "participanteEscolhido", "");
  const [usuarios, setUsuarios] = useState([]);
  const [arquivos, setArquivos] = useState([]);
  const [errosCampo, setErrosCampo] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    listarOpcoesNc().then(setUsuarios).catch(() => setErro("Não foi possível carregar a lista de responsáveis."));
  }, []);

  function alterar(campo, valor) {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }));
    const chaveErro = campo === "responsavel_acao_id" ? "responsavel_acao" : campo;
    if (errosCampo[chaveErro]) setErrosCampo((atuais) => ({ ...atuais, [chaveErro]: undefined }));
  }

  function adicionarParticipante() {
    if (!participanteEscolhido || campos.participantes.includes(participanteEscolhido)) return;
    alterar("participantes", [...campos.participantes, participanteEscolhido]);
    setParticipanteEscolhido("");
  }

  function mostrarErros(erros, mensagemTopo) {
    setErrosCampo(erros);
    setErro(mensagemTopo || resumoErros(erros, ROTULOS_CAMPO_FEEDBACK));
    focarPrimeiroErro(erros, IDS_CAMPOS, ROTULOS_CAMPO_FEEDBACK);
  }

  async function confirmar() {
    setErro("");
    const erros = validar(campos);
    if (Object.keys(erros).length) {
      mostrarErros(erros);
      return;
    }
    setEnviando(true);
    setEtapa("Registrando feedback...");
    try {
      const atualizada = await aplicarFeedback(nc.id, campos);
      let aviso = "";
      if (arquivos.length > 0) {
        setEtapa(`Enviando ${arquivos.length} anexo(s)...`);
        const resultados = await Promise.allSettled(
          arquivos.map((arquivo) => anexarEvidencia(nc.id, arquivo, atualizada.feedback_id))
        );
        const falhas = resultados.filter((resultado) => resultado.status === "rejected").length;
        if (falhas > 0) {
          aviso = `${falhas} de ${arquivos.length} anexo(s) do feedback não puderam ser enviados. O feedback foi registrado normalmente.`;
        }
      }
      limparRascunho(`feedback-nc:${nc.id}`);
      aoConcluir(atualizada, aviso);
    } catch (e) {
      if (e instanceof ErroApi && e.campo && IDS_CAMPOS[e.campo]) {
        mostrarErros({ [e.campo]: e.message }, `O feedback não foi registrado. ${e.message}`);
      } else {
        setErro(e instanceof ErroApi ? e.message : "Não foi possível registrar o feedback.");
      }
    } finally {
      setEnviando(false);
      setEtapa("");
    }
  }

  return (
    <div className="sg-painel">
      <div className="sg-painel__cabecalho">
        <h2 className="sg-painel__titulo">Registrar feedback</h2>
      </div>
      <div className="sg-painel__corpo">
        <HistoricoReincidencia ncId={nc.id} orientativa={nc.tipo_nc === "orientativa"} />

        <p className="texto-secundario texto-sm mb-3">
          Registre o que foi tratado com o colaborador. Todos os campos são obrigatórios, exceto os anexos.
          {nc.prazo_feedback && <> Prazo do feedback: <strong>{formatarPrazo(nc.prazo_feedback)}</strong>.</>}
          Depois do registro, <strong>o colaborador terá 2 dias úteis para registrar o aceite</strong>
          {" "}(contados só em horário de expediente, de segunda a sexta, das 9h às 18h).
        </p>

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        <CampoTextoArea
          id={IDS_CAMPOS.causa_raiz}
          rotulo="Causa raiz"
          obrigatorio
          rows={3}
          value={campos.causa_raiz}
          onChange={(e) => alterar("causa_raiz", e.target.value)}
          erro={errosCampo.causa_raiz}
          readOnly={!!causaDaAnalise}
          helper={causaDaAnalise ? "Vem da análise de causa. Para mudar, revise a análise acima." : "Por que a não conformidade aconteceu."}
          maxLength={4000}
        />
        <CampoTextoArea
          id={IDS_CAMPOS.acao_combinada}
          rotulo="Ação combinada"
          obrigatorio
          rows={3}
          value={campos.acao_combinada}
          onChange={(e) => alterar("acao_combinada", e.target.value)}
          erro={errosCampo.acao_combinada}
          helper="O que será feito para não se repetir."
          maxLength={4000}
        />
        <div className="row g-3">
          <div className="col-md-7">
            <CampoSelecao
              id={IDS_CAMPOS.responsavel_acao}
              rotulo="Responsável pela ação"
              obrigatorio
              value={campos.responsavel_acao_id}
              onChange={(e) => alterar("responsavel_acao_id", e.target.value)}
              erro={errosCampo.responsavel_acao}
            >
              <option value="">Selecione um usuário ativo</option>
              {usuarios.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}{pessoa.setor ? ` (${pessoa.setor})` : ""}
                </option>
              ))}
            </CampoSelecao>
          </div>
          <div className="col-md-5">
            <CampoTexto
              id={IDS_CAMPOS.prazo_acao}
              rotulo="Prazo da ação"
              obrigatorio
              type="date"
              min={hojeEmSaoPaulo()}
              value={campos.prazo_acao}
              onChange={(e) => alterar("prazo_acao", e.target.value)}
              erro={errosCampo.prazo_acao}
            />
          </div>
        </div>
        <CampoTextoArea
          id={IDS_CAMPOS.combinado}
          rotulo="Combinado"
          obrigatorio
          rows={3}
          value={campos.combinado}
          onChange={(e) => alterar("combinado", e.target.value)}
          erro={errosCampo.combinado}
          helper="O que ficou acordado com o colaborador."
          maxLength={4000}
        />

        <CampoTextoArea
          id={IDS_CAMPOS.resumo_conversa}
          rotulo="Resumo da conversa"
          obrigatorio
          rows={3}
          value={campos.resumo_conversa}
          onChange={(e) => alterar("resumo_conversa", e.target.value)}
          erro={errosCampo.resumo_conversa}
          helper="Como foi a conversa de feedback. Se a causa parecer sistêmica, registre a observação aqui."
          maxLength={4000}
        />

        <div className="mb-3">
          <label className="sg-label" htmlFor={IDS_CAMPOS.participantes}>Participantes (opcional)</label>
          <div className="d-flex gap-2">
            <select
              id={IDS_CAMPOS.participantes}
              className={`form-select sg-input${errosCampo.participantes ? " is-invalid" : ""}`}
              value={participanteEscolhido}
              onChange={(e) => setParticipanteEscolhido(e.target.value)}
            >
              <option value="">Quem participou da conversa</option>
              {usuarios.filter((pessoa) => !campos.participantes.includes(pessoa.id)).map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>{pessoa.nome}{pessoa.setor ? ` (${pessoa.setor})` : ""}</option>
              ))}
            </select>
            <Botao variante="secundario" tamanho="sm" disabled={!participanteEscolhido} onClick={adicionarParticipante}>Adicionar</Botao>
          </div>
          {errosCampo.participantes && <div className="invalid-feedback d-block">{errosCampo.participantes}</div>}
          {campos.participantes.length > 0 && (
            <ul className="list-unstyled d-flex flex-wrap gap-2 mt-2 mb-0">
              {campos.participantes.map((id) => (
                <li key={id} className="sg-badge sg-badge--claro">
                  {usuarios.find((pessoa) => pessoa.id === id)?.nome || "Usuário"}{" "}
                  <button type="button" className="btn btn-link btn-sm p-0 ms-1" aria-label="Remover participante"
                    onClick={() => alterar("participantes", campos.participantes.filter((item) => item !== id))}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-3">
          {campos.liberar_posicionamento ? (
            <div className="sg-alerta sg-alerta--info mb-0">
              <div>
                <strong>Posicionamento do colaborador liberado.</strong> No aceite, o colaborador poderá registrar o
                que pensa sobre a NC (opcional para ele).{" "}
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => alterar("liberar_posicionamento", false)}>Desfazer</button>
              </div>
            </div>
          ) : (
            <Botao variante="secundario" tamanho="sm" onClick={() => alterar("liberar_posicionamento", true)}>
              + Posicionamento do colaborador
            </Botao>
          )}
        </div>

        <Form.Group className="mb-3">
          <Form.Label className="sg-label" htmlFor="feedback-anexos">Anexos (opcional)</Form.Label>
          <Form.Control
            id="feedback-anexos"
            type="file"
            multiple
            accept={FORMATOS_ANEXO}
            className="sg-input"
            disabled={enviando}
            onChange={(e) => setArquivos(Array.from(e.target.files || []))}
          />
          <Form.Text className="sg-helper">
            {arquivos.length ? `${arquivos.length} arquivo(s) selecionado(s).` : "Evidências da conversa ou do combinado, se houver."}
          </Form.Text>
        </Form.Group>

        <Botao variante="primario" carregando={enviando} onClick={confirmar}>
          {enviando ? etapa : "Registrar feedback"}
        </Botao>
      </div>
    </div>
  );
}
