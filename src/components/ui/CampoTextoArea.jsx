import Form from "react-bootstrap/Form";

/**
 * Campo textarea padronizado da aplicação.
 * Props:
 *  - rotulo: label do campo
 *  - erro: mensagem de erro exibida abaixo do campo
 *  - helper: texto de ajuda
 *  - obrigatorio: adiciona * ao label
 *  - demais props do <Form.Control as="textarea"> (value, onChange, rows, ...)
 */
export default function CampoTextoArea({
    rotulo,
    erro,
    helper,
    obrigatorio = false,
    rows = 4,
    ...props
}) {
    return (
        <Form.Group className="mb-3">
            {rotulo && (
                <Form.Label className="sg-label">
                    {rotulo}
                    {obrigatorio && <span className="text-danger"> *</span>}
                </Form.Label>
            )}
            <Form.Control
                as="textarea"
                rows={rows}
                className={`sg-textarea ${erro ? "sg-textarea--erro" : ""}`}
                aria-invalid={erro ? "true" : undefined}
                {...props}
            />
            {helper && <Form.Text className="sg-helper">{helper}</Form.Text>}
            {erro && <span className="sg-erro-campo" role="alert">{erro}</span>}
        </Form.Group>
    );
}