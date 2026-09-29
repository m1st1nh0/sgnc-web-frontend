import { useState } from "react";
import Form from "react-bootstrap/Form";

import { aceitarNc } from "../services/ncService";
import { ErroApi } from "../services/api";
import Botao from "./ui/Botao";
import MensagemErro from "./ui/MensagemErro";

const FRASE_ESPERADA = "Li e concordo com a não conformidade e com o feedback aplicado";

/**
 * Exibido só para o colaborador (dono da NC), quando ela está
 * 'aguardando_aceite'. Exige digitar a frase de confirmação exata
 * como uma "assinatura" de baixa fricção, mas intencional.
 */
export default function PainelAceite({ nc, aoConcluir }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar() {
    setErro("");
    setEnviando(true);
    try {
      const atualizada = await aceitarNc(nc.id, texto);
      aoConcluir(atualizada);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível registrar o aceite.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="sg-painel">
      <div className="sg-painel__cabecalho">
        <h2 className="sg-painel__titulo">Aceite do feedback</h2>
      </div>
      <div className="sg-painel__corpo">
        <p className="texto-secundario texto-sm mb-3">
          Para confirmar que você leu e está de acordo, digite exatamente a
          frase abaixo:
        </p>
        <p className="fw-semibold small border rounded p-2 sg-badge--claro mb-3">
          {FRASE_ESPERADA}
        </p>

        {erro && <MensagemErro mensagem={erro} />}

        <Form.Group className="mb-3">
          <Form.Label className="sg-label">Frase de confirmação</Form.Label>
          <Form.Control
            type="text"
            className="sg-input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite a frase de confirmação"
          />
        </Form.Group>

        <Botao variante="sucesso" carregando={enviando} onClick={confirmar}>
          Confirmar aceite
        </Botao>
      </div>
    </div>
  );
}
