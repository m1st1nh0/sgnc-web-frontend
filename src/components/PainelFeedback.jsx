import { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";

import { aplicarFeedback } from "../services/ncService";
import { ErroApi } from "../services/api";

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
    <Card className="shadow-sm border-primary">
      <Card.Body>
        <Card.Title className="h6">Aplicar feedback</Card.Title>
        <Card.Text className="text-muted small">
          Descreva o que ficou combinado com o colaborador. Este texto
          ficará visível a ele e ao supervisor, e será necessário o
          aceite formal do colaborador para concluir a NC.
        </Card.Text>

        {erro && <Alert variant="danger">{erro}</Alert>}

        <Form.Group className="mb-3">
          <Form.Control
            as="textarea"
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            autoFocus
          />
        </Form.Group>

        <Button variant="primary" disabled={enviando} onClick={confirmar}>
          {enviando ? "Enviando..." : "Aplicar feedback"}
        </Button>
      </Card.Body>
    </Card>
  );
}
