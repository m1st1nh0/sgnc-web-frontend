import { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";

import { enviarNc } from "../services/ncService";
import { ErroApi } from "../services/api";

/**
 * Exibido só para o ADM, quando a NC está 'validada'.
 * Ao enviar, o colaborador e o supervisor passam a enxergar a NC.
 */
export default function PainelEnviar({ nc, aoConcluir }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar() {
    setErro("");
    setEnviando(true);
    try {
      const atualizada = await enviarNc(nc.id);
      aoConcluir(atualizada);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível enviar a NC.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="shadow-sm border-primary">
      <Card.Body>
        <Card.Title className="h6">Enviar ao colaborador</Card.Title>
        <Card.Text className="text-muted small">
          Esta NC foi validada. Ao enviar, o colaborador analisado e seu
          supervisor passam a ter acesso a ela.
        </Card.Text>

        {erro && <Alert variant="danger">{erro}</Alert>}

        <Button variant="primary" disabled={enviando} onClick={confirmar}>
          {enviando ? "Enviando..." : "Enviar"}
        </Button>
      </Card.Body>
    </Card>
  );
}
