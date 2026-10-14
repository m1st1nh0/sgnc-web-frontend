import { acaoPendente, etapasDaNc } from "../client/statusNc.js";
import { formatarPrazo } from "../../../lib/utils/formato.js";

const ROTULO_SITUACAO = {
  feita: "concluída",
  atual: "etapa atual",
  atrasada: "prazo vencido",
  pendente: "a seguir",
  encerrada: "encerrada",
};

/**
 * Trilha das etapas da NC em barra única, com a etapa atual destacada e com quem a NC está agora.
 * `compacta`: sem cartão próprio, para o painel de detalhe da Gestão de NCs.
 */
export default function EtapasNc({ nc, visualizadorId, compacta = false }) {
  const etapas = etapasDaNc(nc, visualizadorId);
  const pendente = acaoPendente(nc, visualizadorId);
  if (!etapas.length) return null;
  const idTitulo = compacta ? `etapas-nc-${nc.id}-titulo` : "etapas-nc-titulo";

  const conteudo = (
    <>
      <h2 id={idTitulo} className={compacta ? "visually-hidden" : "sg-secao-titulo"}>Andamento da NC</h2>
      <ol className="sg-etapas" style={{ "--etapas": etapas.length }}>
        {etapas.map((etapa, indice) => (
          <li
            key={etapa.chave}
            className={`sg-etapas__item sg-etapas__item--${etapa.situacao}`}
            aria-current={["atual", "atrasada"].includes(etapa.situacao) ? "step" : undefined}
          >
            <span className="sg-etapas__barra" aria-hidden="true" />
            <span className="sg-etapas__rotulo">
              {indice + 1}. {etapa.rotulo}
              <span className="visually-hidden"> ({ROTULO_SITUACAO[etapa.situacao]})</span>
            </span>
            {etapa.responsavel && <span className="sg-etapas__responsavel">Com {etapa.responsavel === "Você" ? "você" : etapa.responsavel}</span>}
            {etapa.prazo && (
              <span className="sg-etapas__prazo">
                {etapa.situacao === "atrasada" ? "venceu " : "até "}{formatarPrazo(etapa.prazo)}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className={`sg-etapas__resumo${nc.status === "nao_respondida" ? " sg-etapas__resumo--atrasada" : ""}`} role="status">
        {pendente ? (
          <>
            <strong>Com quem está: {pendente.responsavel}</strong>
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
    </>
  );

  if (compacta) return <section className="sg-etapas-bloco" aria-labelledby={idTitulo}>{conteudo}</section>;
  return <section className="sg-cartao sg-etapas-bloco" aria-labelledby={idTitulo}>{conteudo}</section>;
}
