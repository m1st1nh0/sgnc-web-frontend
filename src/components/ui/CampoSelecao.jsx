import Form from "react-bootstrap/Form";

/**
 * Campo select padronizado da aplicação.
 * Props:
 *  - rotulo: label do campo
 *  - erro: mensagem de erro exibida abaixo do campo
 *  - helper: texto de ajuda
 *  - obrigatorio: adiciona * ao label
 *  - children: <option> elements
 *  - demais props do <Form.Select> (value, onChange, ...)
 */
export default function CampoSelecao({
    rotulo,
    erro,
    helper,
    obrigatorio = false,
    children,
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
            <Form.Select
                className={`sg-select ${erro ? "sg-select--erro" : ""}`}
                aria-invalid={erro ? "true" : undefined}
                {...props}
            >
                {children}
            </Form.Select>
            {helper && <Form.Text className="sg-helper">{helper}</Form.Text>}
            {erro && <span className="sg-erro-campo" role="alert">{erro}</span>}
        </Form.Group>
    );
}