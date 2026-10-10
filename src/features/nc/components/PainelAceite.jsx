import { useState } from "react";
import Form from "react-bootstrap/Form";

import { aceitarNc } from "../client/ncService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import Botao from "../../../components/ui/Botao.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { formatarPrazo } from "../../../lib/utils/formato.js";

const FRASE_ESPERADA = "Li e concordo com a não conformidade e com o feedback aplicado";

/**
 * Exibido só para o colaborador (dono da NC), quando ela está 'aguardando_aceite'
 * ou 'nao_respondida' (D11: o aceite tardio continua possível e fica fora do prazo).
 * Exige digitar a frase de confirmação exata (D6).
 */
export default function PainelAceite({ nc, aoConcluir }) {
  const prazo = nc.feedback_estruturado?.prazo_aceite;
  const naoRespondida = nc.status === "nao_respondida";
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
        {naoRespondida ? (
          <div className="sg-alerta sg-alerta--erro mb-3" role="status">
            <div>
              <strong>Prazo vencido{prazo ? ` em ${formatarPrazo(prazo)}` : ""}.</strong> O aceite ainda pode ser
              registrado e ficará marcado como fora do prazo.
            </div>
          </div>
        ) : prazo && (
          <div className="sg-alerta sg-alerta--atencao mb-3" role="status">
            <div><strong>Responda até {formatarPrazo(prazo)}.</strong> Leia o feedback acima antes de confirmar.</div>
          </div>
        )}
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
