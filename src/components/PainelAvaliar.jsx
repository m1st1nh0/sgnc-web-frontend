import { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import ButtonGroup from "react-bootstrap/ButtonGroup";

import { avaliarNc } from "../services/ncService";
import { ErroApi } from "../services/api";

/**
 * Exibido só para o ADM, quando a NC está em 'aberta'.
 * Decide se a NC é procedente (validada) ou não (invalidada,
 * exigindo motivo).
 */
export default function PainelAvaliar({ nc, aoConcluir }) {
  const [decisao, setDecisao] = useState(null); // "validar" | "invalidar" | null
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
    <Card className="shadow-sm border-primary">
      <Card.Body>
        <Card.Title className="h6">Avaliar Não Conformidade</Card.Title>
        <Card.Text className="text-muted small">
          Esta NC ainda não foi avaliada. Ela é procedente?
        </Card.Text>

        {erro && <Alert variant="danger">{erro}</Alert>}

        {decisao !== "invalidar" ? (
          <ButtonGroup>
            <Button variant="success" disabled={enviando} onClick={confirmarValidar}>
              Validar
            </Button>
            <Button variant="outline-danger" disabled={enviando} onClick={() => setDecisao("invalidar")}>
              Invalidar
            </Button>
          </ButtonGroup>
        ) : (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Motivo da invalidação *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                autoFocus
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button variant="danger" disabled={enviando} onClick={confirmarInvalidar}>
                {enviando ? "Enviando..." : "Confirmar invalidação"}
              </Button>
              <Button variant="outline-secondary" disabled={enviando} onClick={() => setDecisao(null)}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
