import Form from "react-bootstrap/Form";

/**
 * Campo de texto padronizado da aplicação.
 * Props:
 *  - rotulo: label do campo
 *  - erro: mensagem de erro exibida abaixo do campo
 *  - helper: texto de ajuda
 *  - obrigatorio: adiciona * ao label
 *  - demais props do <Form.Control> (type, value, onChange, placeholder, ...)
 */
export default function CampoTexto({
    rotulo,
    erro,
    helper,
    obrigatorio = false,
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
                className={`sg-input ${erro ? "sg-input--erro" : ""}`}
                aria-invalid={erro ? "true" : undefined}
                {...props}
            />
            {helper && <Form.Text className="sg-helper">{helper}</Form.Text>}
            {erro && <span className="sg-erro-campo" role="alert">{erro}</span>}
        </Form.Group>
    );
}