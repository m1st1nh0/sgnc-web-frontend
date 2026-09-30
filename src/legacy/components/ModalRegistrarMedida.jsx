import { useState } from "react";
import Modal from "react-bootstrap/Modal";

import Botao from "./ui/Botao";
import CampoSelecao from "./ui/CampoSelecao";
import CampoTexto from "./ui/CampoTexto";
import CampoTextoArea from "./ui/CampoTextoArea";
import MensagemErro from "./ui/MensagemErro";

const ROTULOS_TIPO = {
  advertencia: "Advertência",
  suspensao: "Suspensão",
  avaliar_justa_causa: "Avaliar justa causa/permanência",
};

/**
 * Modal para registrar manualmente uma medida disciplinar da última
 * ocorrência contabilizada de uma causa. A medida não é aplicada pelo
 * sistema: o ADM registra o que realmente aconteceu (advertência,
 * suspensão ou avaliação de justa causa).
 *
 * Props:
 *  - visivel: boolean
 *  - causa: objeto da causa (causa_id, causa, ultima_ocorrencia_numero,
 *    ultima_ocorrencia_nc_id, medida_sugerida)
 *  - erro: mensagem de erro vinda da API (opcional)
 *  - aoFechar: função para fechar o modal
 *  - aoRegistrar: chamada com { causa_id, nc_id, ocorrencia_gatilho, tipo,
 *    dias_suspensao, observacao }
 *  - carregando: desabilita botões e mostra loading
 */
export default function ModalRegistrarMedida({
  visivel,
  causa,
  erro,
  aoFechar,
  aoRegistrar,
  carregando = false,
}) {
  const [tipo, setTipo] = useState(() => causa?.medida_sugerida || "advertencia");
  const [diasSuspensao, setDiasSuspensao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erroLocal, setErroLocal] = useState("");

  function confirmar() {
    setErroLocal("");

    if (tipo === "suspensao") {
      const dias = Number(diasSuspensao);
      if (!diasSuspensao || !Number.isInteger(dias) || dias < 1 || dias > 30) {
        setErroLocal("A suspensão deve possuir entre 1 e 30 dias.");
        return;
      }
    }

    aoRegistrar({
      causa_id: causa.causa_id,
      nc_id: causa.ultima_ocorrencia_nc_id,
      ocorrencia_gatilho: causa.ultima_ocorrencia_numero,
      tipo,
      dias_suspensao: tipo === "suspensao" ? Number(diasSuspensao) : null,
      observacao: observacao.trim() || undefined,
    });
  }

  return (
    <Modal show={visivel} onHide={aoFechar} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h5">Registrar medida disciplinar</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {visivel && causa && (
          <>
            <p className="texto-secundario texto-sm">
              A {causa.ultima_ocorrencia_numero}ª ocorrência da causa{" "}
              <strong>{causa.causa}</strong> ultrapassou o gatilho e está
              passível de medida disciplinar (NC #{causa.ultima_ocorrencia_nc_id}).
              Registre aqui o que foi aplicado na vida real.
            </p>

            <CampoSelecao
              rotulo="Medida aplicada"
              obrigatorio
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              {Object.entries(ROTULOS_TIPO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </CampoSelecao>

            {tipo === "suspensao" && (
              <CampoTexto
                rotulo="Dias de suspensão"
                obrigatorio
                type="number"
                min={1}
                max={30}
                value={diasSuspensao}
                onChange={(e) => setDiasSuspensao(e.target.value)}
              />
            )}

            <CampoTextoArea
              rotulo="Observação"
              helper="Contexto da medida aplicada (opcional)."
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />

            {(erro || erroLocal) && (
              <MensagemErro mensagem={erro || erroLocal} />
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Botao variante="secundario" onClick={aoFechar} disabled={carregando}>
          Cancelar
        </Botao>
        <Botao variante="primario" onClick={confirmar} carregando={carregando}>
          Registrar medida
        </Botao>
      </Modal.Footer>
    </Modal>
  );
}