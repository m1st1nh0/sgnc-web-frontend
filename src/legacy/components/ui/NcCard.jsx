import BadgeStatus from "./BadgeStatus";
import BadgePrioridade from "./BadgePrioridade";
import { formatarData } from "../../utils/formato";
import { infoDoStatus } from "../../services/statusNc";

export default function NcCard({ nc, aoClicar, abertoPorNome }) {
  const { etapa } = infoDoStatus(nc.status);

  return (
    <div
      className={`sg-nc-card sg-nc-card--${etapa}`}
      onClick={aoClicar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          aoClicar();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`Ver detalhes da não conformidade ${nc.id}`}
    >
      <div className="sg-nc-card__principal">
        <span className="sg-nc-card__numero">NC #{nc.id}</span>
        <div className="sg-nc-card__info">
          <p className="sg-nc-card__titulo">
            {nc.colaborador || "Colaborador não informado"}
          </p>
          <div className="sg-nc-card__meta">
            <span>{formatarData(nc.data)}</span>
            {abertoPorNome && <span>Aberto por: {abertoPorNome}</span>}
            {nc.setor && <span>{nc.setor}</span>}
            {nc.chamado && <span>Chamado: {nc.chamado}</span>}
          </div>
        </div>
      </div>
      <div className="sg-nc-card__secundario">
        <BadgePrioridade criticidade={nc.criticidade} />
        <BadgeStatus status={nc.status} />
      </div>
    </div>
  );
}
