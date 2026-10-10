import { acaoPendente, etapasDaNc } from "../client/statusNc.js";

const ROTULO_SITUACAO = {
  feita: "concluída",
  atual: "etapa atual",
  pendente: "a seguir",
  encerrada: "encerrada",
};

/** Trilha das etapas da NC com a etapa atual destacada e quem precisa agir agora. */
export default function EtapasNc({ nc, visualizadorId }) {
  const etapas = etapasDaNc(nc, visualizadorId);
  const pendente = acaoPendente(nc, visualizadorId);
  if (!etapas.length) return null;

  return (
    <section className="sg-card" aria-labelledby="etapas-nc-titulo">
      <div className="sg-card-body p-4">
        <h2 id="etapas-nc-titulo" className="h6 mb-3">Andamento da NC</h2>
        <ol className="sg-etapas">
          {etapas.map((etapa, indice) => (
            <li
              key={etapa.chave}
              className={`sg-etapas__item sg-etapas__item--${etapa.situacao}`}
              aria-current={etapa.situacao === "atual" ? "step" : undefined}
            >
              <span className="sg-etapas__marcador" aria-hidden="true">
                {etapa.situacao === "feita" ? "✓" : etapa.situacao === "encerrada" ? "✕" : indice + 1}
              </span>
              <span className="sg-etapas__texto">
                <span className="sg-etapas__rotulo">{etapa.rotulo}</span>
                <span className="visually-hidden"> ({ROTULO_SITUACAO[etapa.situacao]})</span>
                {etapa.responsavel && <span className="sg-etapas__responsavel">{etapa.responsavel}</span>}
              </span>
            </li>
          ))}
        </ol>
        <div className="sg-etapas__resumo" role="status">
          {pendente ? (
            <>
              <strong>Aguardando: {pendente.responsavel}</strong>
              <span>{pendente.descricao}</span>
            </>
          ) : nc.status === "invalidada" ? (
            <>
              <strong>NC encerrada na avaliação</strong>
              <span>{nc.motivo_invalidacao || "A ocorrência foi invalidada pela Qualidade."}</span>
            </>
          ) : (
            <strong>Não há ação pendente nesta não conformidade.</strong>
          )}
        </div>
      </div>
    </section>
  );
}
