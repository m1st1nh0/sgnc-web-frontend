import { useState } from "react";
import Form from "react-bootstrap/Form";

import { avaliarNc } from "../services/ncService";
import { ErroApi } from "../services/api";
import Botao from "./ui/Botao";
import MensagemErro from "./ui/MensagemErro";

/**
 * Exibido para o ADM quando a NC está aberta.
 * Validar agora avança diretamente para "aguardando_feedback" e torna a NC
 * visível ao colaborador analisado e ao supervisor direto.
 */
export default function PainelAvaliar({ nc, aoConcluir }) {
  const [decisao, setDecisao] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmarValidar() {
    setErro("");
    setEnviando(true);
    try {
      const atualizada = await avaliarNc(nc.id, "validar");
      aoConcluir(atualizada);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível validar a NC.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarInvalidar() {
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

        {erro && <MensagemErro mensagem={erro} />}

        {decisao !== "invalidar" ? (
          <div className="d-flex gap-2">
            <Botao variante="sucesso" carregando={enviando} onClick={confirmarValidar}>
              Validar e seguir para feedback
            </Botao>
            <Botao variante="secundario" disabled={enviando} onClick={() => setDecisao("invalidar")}>
              Invalidar
            </Botao>
          </div>
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
                autoFocus
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Botao variante="perigo" carregando={enviando} onClick={confirmarInvalidar}>
                Confirmar invalidação
              </Botao>
              <Botao variante="secundario" disabled={enviando} onClick={() => setDecisao(null)}>
                Cancelar
              </Botao>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
