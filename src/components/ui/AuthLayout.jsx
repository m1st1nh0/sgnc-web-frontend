/**
 * Layout compartilhado das telas de autenticação (login e troca de senha).
 * Centraliza o wrapper de fundo, o logo e o card para evitar duplicação.
 *
 * Props:
 *  - children: conteúdo do card (formulário)
 */
export default function AuthLayout({ children }) {
    return (
        <div className="sg-auth-wrapper">
            <div className="sg-auth-card">
                <div className="sg-auth-logo" aria-hidden="true">
                    NC
                </div>
                <div className="sg-card">
                    <div className="sg-card-body p-4">{children}</div>
                </div>
            </div>
        </div>
    );
}