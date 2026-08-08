import Spinner from "react-bootstrap/Spinner";

/**
 * Estado de carregamento padronizado.
 * Props:
 *  - mensagem: texto exibido junto ao spinner (opcional)
 *  - compacto: se true, usa menos padding (útil dentro de cards)
 */
export default function EstadoCarregamento({ mensagem = "Carregando...", compacto = false }) {
    return (
        <div
            className="sg-estado"
            style={compacto ? { padding: "var(--espaco-5)" } : undefined}
            role="status"
            aria-live="polite"
        >
            <Spinner animation="border" variant="primary" />
            <p className="sg-estado__descricao mb-0">{mensagem}</p>
        </div>
    );
}