import Modal from "react-bootstrap/Modal";

import Botao from "./Botao";

/**
 * Modal para visualizar a imagem de uma evidência anexada dentro da
 * própria página, no lugar de abrir em uma nova guia.
 *
 * Props:
 *  - visivel: boolean
 *  - evidencia: objeto da evidência (nome_original, url_temporaria)
 *  - aoFechar: função chamada ao fechar o modal
 */
export default function ModalVisualizarEvidencia({ visivel, evidencia, aoFechar }) {
  return (
    <Modal
      show={visivel}
      onHide={aoFechar}
      size="xl"
      centered
      dialogClassName="sg-modal-visualizar"
    >
      <Modal.Header closeButton>
        <Modal.Title className="h5">
          {evidencia ? evidencia.nome_original : ""}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {visivel && evidencia && evidencia.url_temporaria && (
          <div className="sg-visualizador">
            <img
              src={evidencia.url_temporaria}
              alt={evidencia.nome_original}
              className="sg-visualizador__imagem"
            />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {evidencia?.url_temporaria && (
          <a
            href={evidencia.url_temporaria}
            target="_blank"
            rel="noopener noreferrer"
            className="sg-evidencia-item__link me-auto"
          >
            Abrir em nova guia
          </a>
        )}
        <Botao variante="primario" onClick={aoFechar}>
          Fechar
        </Botao>
      </Modal.Footer>
    </Modal>
  );
}