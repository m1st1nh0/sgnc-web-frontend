import Modal from "react-bootstrap/Modal";
import Botao from "./Botao";

/**
 * Modal de confirmação padronizado.
 * Props:
 *  - visivel: boolean
 *  - titulo: título do modal
 *  - mensagem: texto da confirmação
 *  - aoFechar: função para fechar
 *  - aoConfirmar: função chamada ao confirmar
 *  - carregando: desabilita botões e mostra loading no botão de confirmar
 *  - textoConfirmar: texto do botão de confirmar (padrão "Confirmar")
 */
export default function ModalConfirmacao({
    visivel,
    titulo,
    mensagem,
    aoFechar,
    aoConfirmar,
    carregando = false,
    textoConfirmar = "Confirmar",
}) {
    return (
        <Modal show={visivel} onHide={aoFechar} centered>
            <Modal.Header closeButton>
                <Modal.Title className="h5">{titulo}</Modal.Title>
            </Modal.Header>
            <Modal.Body>{mensagem}</Modal.Body>
            <Modal.Footer>
                <Botao variante="secundario" onClick={aoFechar} disabled={carregando}>
                    Cancelar
                </Botao>
                <Botao variante="perigo" onClick={aoConfirmar} carregando={carregando}>
                    {textoConfirmar}
                </Botao>
            </Modal.Footer>
        </Modal>
    );
}