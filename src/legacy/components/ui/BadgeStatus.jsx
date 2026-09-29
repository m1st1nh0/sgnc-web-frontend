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

export default function BadgeStatus({ status }) {
  const { rotulo, cor, etapa } = infoDoStatus(status);
  const classe = MAPA_COR[cor] ?? "sg-badge--cinza";

  return (
    <span className={`sg-badge sg-status sg-status--${etapa} ${classe}`}>
      <span className="sg-status__marcador" aria-hidden="true" />
      {rotulo}
    </span>
  );
}
