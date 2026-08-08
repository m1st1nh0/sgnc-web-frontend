import { useState } from "react";
import Form from "react-bootstrap/Form";

import { aplicarFeedback } from "../services/ncService";
import { ErroApi } from "../services/api";
import Botao from "./ui/Botao";
import MensagemErro from "./ui/MensagemErro";

/**
 * Exibido só para o ADM, quando a NC está 'aguardando_analise'.
 * O feedback registrado aqui fica visível ao colaborador e ao
 * supervisor, e depois exige o aceite formal do colaborador.
 */
export default function PainelFeedback({ nc, aoConcluir }) {
  const [feedback, setFeedback] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar() {
    setErro("");
    if (!feedback.trim()) {
      setErro("Descreva o feedback/combinado com o colaborador.");
      return;
    }
    setEnviando(true);
    try {
      const atualizada = await aplicarFeedback(nc.id, feedback);
      aoConcluir(atualizada);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível aplicar o feedback.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="sg-painel">
      <div className="sg-painel__cabecalho">
        <h2 className="sg-painel__titulo">Aplicar feedback</h2>
      </div>
      <div className="sg-painel__corpo">
        <p className="texto-secundario texto-sm mb-3">
          Descreva o que ficou combinado com o colaborador. Este texto
          ficará visível a ele e ao supervisor, e será necessário o
          aceite formal do colaborador para concluir a NC.
        </p>

        {erro && <MensagemErro mensagem={erro} />}

        <Form.Group className="mb-3">
          <Form.Label className="sg-label">Feedback</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            className="sg-textarea"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            autoFocus
          />
        </Form.Group>

        <Botao variante="primario" carregando={enviando} onClick={confirmar}>
          Aplicar feedback
        </Botao>
      </div>
    </div>
  );
}
