import { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";

import { aceitarNc } from "../services/ncService";
import { ErroApi } from "../services/api";

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
    <Card className="shadow-sm border-primary">
      <Card.Body>
        <Card.Title className="h6">Aceite do feedback</Card.Title>
        <Card.Text className="text-muted small">
          Para confirmar que você leu e está de acordo, digite exatamente a
          frase abaixo:
        </Card.Text>
        <p className="fw-semibold small border rounded p-2 bg-light">
          {FRASE_ESPERADA}
        </p>

        {erro && <Alert variant="danger">{erro}</Alert>}

        <Form.Group className="mb-3">
          <Form.Control
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite a frase de confirmação"
          />
        </Form.Group>

        <Button variant="success" disabled={enviando} onClick={confirmar}>
          {enviando ? "Enviando..." : "Confirmar aceite"}
        </Button>
      </Card.Body>
    </Card>
  );
}
