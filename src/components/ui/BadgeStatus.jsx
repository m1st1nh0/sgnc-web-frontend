import { infoDoStatus } from "../../services/statusNc";

const MAPA_COR = {
    secondary: "sg-badge--cinza",
    danger: "sg-badge--vermelho",
    info: "sg-badge--azul",
    warning: "sg-badge--amarelo",
    success: "sg-badge--verde",
    dark: "sg-badge--escuro",
    light: "sg-badge--claro",
};

/**
 * Badge de status de Não Conformidade.
 * Usa a fonte única de verdade em services/statusNc.js.
 *
 * Props:
 *  - status: string (ex: "aberta", "concluida", ...)
 */
export default function BadgeStatus({ status }) {
    const { rotulo, cor } = infoDoStatus(status);
    const classe = MAPA_COR[cor] ?? "sg-badge--cinza";

    return <span className={`sg-badge ${classe}`}>{rotulo}</span>;
}