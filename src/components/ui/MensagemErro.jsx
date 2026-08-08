/**
 * Mensagem de erro padronizada.
 * Props:
 *  - mensagem: texto do erro
 *  - onFechar: função chamada ao clicar no "x" (opcional)
 */
export default function MensagemErro({ mensagem, onFechar }) {
    if (!mensagem) return null;

    return (
        <div className="sg-alerta sg-alerta--erro" role="alert">
            <span>{mensagem}</span>
            {onFechar && (
                <button
                    type="button"
                    className="btn-close ms-auto"
                    aria-label="Fechar"
                    onClick={onFechar}
                />
            )}
        </div>
    );
}