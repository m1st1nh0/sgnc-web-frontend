import { useState } from "react";
import Form from "react-bootstrap/Form";

import { avaliarNc } from "../client/ncService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import Botao from "../../../components/ui/Botao.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { AJUDA_TIPO_NC, ORIGENS_NC, TIPOS_NC, validarClassificacao } from "../../../lib/nc/classificacao.js";

/**
 * Exibido para o ADM quando a NC está aberta.
 * `bloqueado` evita uma corrida entre upload de evidência e mudança de status.
 */
export default function PainelAvaliar({ nc, aoConcluir, bloqueado = false }) {
  const [decisao, setDecisao] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  // Classificação feita pela Qualidade na validação (origem obrigatória; procedimento e link opcionais).
  const [classificacao, setClassificacao] = useState({ origem: "", tipo_nc: "cobranca", procedimento: "", procedimento_url: "" });
  const [errosCampo, setErrosCampo] = useState({});
  const alterar = (campo) => (e) => {
    setClassificacao((atual) => ({ ...atual, [campo]: e.target.value }));
    setErrosCampo((atual) => ({ ...atual, [campo]: undefined }));
  };

  async function confirmarValidar() {
    if (bloqueado) return;
    setErro("");
    const checagem = validarClassificacao(classificacao);
    if (checagem.erro) {
      setErrosCampo({ [checagem.erro.campo]: checagem.erro.mensagem });
      document.getElementById(`avaliar-${checagem.erro.campo}`)?.focus();
      return;
    }
    setEnviando(true);
    try {
      const atualizada = await avaliarNc(nc.id, "validar", undefined, checagem.valor);
      aoConcluir(atualizada);
    } catch (e) {
      if (e instanceof ErroApi && e.campo) {
        setErrosCampo({ [e.campo]: e.message });
        document.getElementById(`avaliar-${e.campo}`)?.focus();
      } else {
        setErro(e instanceof ErroApi ? e.message : "Não foi possível validar a NC.");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarInvalidar() {
    if (bloqueado) return;
    setErro("");
    if (!motivo.trim()) {
      setErro("Informe o motivo da invalidação.");
      return;
    }
    setEnviando(true);
    try {
      const atualizada = await avaliarNc(nc.id, "invalidar", motivo);
      aoConcluir(atualizada);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível invalidar a NC.");
    } finally {
      setEnviando(false);
    }
  }

  const indisponivel = enviando || bloqueado;

  return (
    <div className="sg-painel">
      <div className="sg-painel__cabecalho">
        <h2 className="sg-painel__titulo">Avaliar Não Conformidade</h2>
      </div>
      <div className="sg-painel__corpo">
        <p className="texto-secundario texto-sm mb-2">
          Esta NC ainda não foi avaliada. Ela é procedente?
        </p>
        <p className="texto-xs texto-suave mb-3">
          Ao validar, ela seguirá diretamente para feedback e ficará disponível
          ao colaborador analisado e ao supervisor direto.
        </p>

        {bloqueado && (
          <div className="sg-alerta sg-alerta--info mb-3">
            Aguarde o envio da evidência terminar antes de avaliar esta NC.
          </div>
        )}
        {erro && <MensagemErro mensagem={erro} />}

        {decisao !== "invalidar" ? (
          <>
          <fieldset className="mb-3" disabled={indisponivel}>
            <legend className="sg-label mb-2">Classificação da NC</legend>
            <Form.Group className="mb-3" controlId="avaliar-origem">
              <Form.Label className="sg-label">Origem *</Form.Label>
              <Form.Select className="sg-input" value={classificacao.origem} onChange={alterar("origem")} isInvalid={!!errosCampo.origem}>
                <option value="">Selecione</option>
                {Object.entries(ORIGENS_NC).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{errosCampo.origem}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="sg-label d-block">Tipo *</Form.Label>
              {Object.entries(TIPOS_NC).map(([valor, rotulo]) => (
                <Form.Check
                  key={valor}
                  type="radio"
                  id={valor === "cobranca" ? "avaliar-tipo_nc" : `avaliar-tipo-${valor}`}
                  name="avaliar-tipo"
                  label={<><strong>{rotulo}</strong> <span className="texto-xs texto-secundario">{AJUDA_TIPO_NC[valor]}</span></>}
                  checked={classificacao.tipo_nc === valor}
                  onChange={() => alterar("tipo_nc")({ target: { value: valor } })}
                  isInvalid={!!errosCampo.tipo_nc}
                />
              ))}
              {errosCampo.tipo_nc && <div className="invalid-feedback d-block">{errosCampo.tipo_nc}</div>}
            </Form.Group>
            <Form.Group className="mb-3" controlId="avaliar-procedimento">
              <Form.Label className="sg-label">Procedimento descumprido (opcional)</Form.Label>
              <Form.Control className="sg-input" value={classificacao.procedimento} onChange={alterar("procedimento")} maxLength={300} isInvalid={!!errosCampo.procedimento} />
              <Form.Control.Feedback type="invalid">{errosCampo.procedimento}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group controlId="avaliar-procedimento_url">
              <Form.Label className="sg-label">Link do procedimento na intranet (opcional)</Form.Label>
              <Form.Control className="sg-input" type="url" inputMode="url" placeholder="https://" value={classificacao.procedimento_url} onChange={alterar("procedimento_url")} isInvalid={!!errosCampo.procedimento_url} />
              <Form.Control.Feedback type="invalid">{errosCampo.procedimento_url}</Form.Control.Feedback>
            </Form.Group>
          </fieldset>
          <div className="d-flex gap-2">
            <Botao
              variante="sucesso"
              carregando={enviando}
              disabled={indisponivel}
              onClick={confirmarValidar}
            >
              Validar e seguir para feedback
            </Botao>
            <Botao
              variante="secundario"
              disabled={indisponivel}
              onClick={() => setDecisao("invalidar")}
            >
              Invalidar
            </Botao>
          </div>
          </>
        ) : (
          <>
            <Form.Group className="mb-3">
              <Form.Label className="sg-label">Motivo da invalidação *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                className="sg-textarea"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={indisponivel}
                autoFocus
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Botao
                variante="perigo"
                carregando={enviando}
                disabled={indisponivel}
                onClick={confirmarInvalidar}
              >
                Confirmar invalidação
              </Botao>
              <Botao
                variante="secundario"
                disabled={indisponivel}
                onClick={() => setDecisao(null)}
              >
                Cancelar
              </Botao>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
