import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";

/**
 * Botão padronizado da aplicação.
 *
 * Props:
 *  - variante: "primario" | "secundario" | "perigo" | "sucesso" | "subtle"
 *  - tamanho: "sm" | "mwd" | "lg"
 *  - carregando: mostra spinner no lugar do conteúdo
 *  - children: conteúdo do botão
 *  - demais props do <Button> do React Bootstrap (onClick, type, disabled, ...)
 */
export default function Botao({
    variante = "primario",
    tamanho = "md",
    carregando = false,
    children,
    disabled,
    ...props
}) {
    const classeVariante = {
        primario: "sg-btn--primario",
        secundario: "sg-btn--secundario",
        perigo: "sg-btn--perigo",
        sucesso: "sg-btn--sucesso",
        subtle: "sg-btn--subtle",
    }[variante];

    const classeTamanho = {
        sm: "sg-btn--sm",
        md: "sg-btn--md",
        lg: "sg-btn--lg",
    }[tamanho];

    return (
        <Button
            className={`sg-btn ${classeVariante} ${classeTamanho}`}
            disabled={disabled || carregando}
            {...props}
        >
            {carregando ? (
                <>
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    <span className="visually-hidden">Carregando...</span>
                </>
            ) : (
                children
            )}
        </Button>
    );
}