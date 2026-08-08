import Card from "react-bootstrap/Card";

/**
 * Card padronizado da aplicação.
 * Props:
 *  - children: conteúdo do card
 *  - className: classes adicionais (opcional)
 */
export default function Cartao({ children, className = "", ...props }) {
    return (
        <Card className={`sg-card ${className}`} {...props}>
            {children}
        </Card>
    );
}