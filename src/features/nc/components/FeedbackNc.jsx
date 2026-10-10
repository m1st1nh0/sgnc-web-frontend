import { situacaoDoAceite } from "../../../lib/nc/reincidencia";
import { formatarData, formatarDataHora, formatarPrazo } from "../../../lib/utils/formato.js";

const SITUACAO_ACEITE = {
  aguardando: { rotulo: "Aguardando aceite", classe: "sg-badge--amarelo" },
  no_prazo: { rotulo: "Aceito no prazo", classe: "sg-badge--verde" },
  fora_prazo: { rotulo: "Aceito fora do prazo", classe: "sg-badge--vermelho" },
  nao_respondida: { rotulo: "Não respondida", classe: "sg-badge--vermelho" },
  sem_feedback: { rotulo: "Sem feedback", classe: "sg-badge--cinza" },
};

/**
 * Seção "Feedback" do detalhe: os cinco campos estruturados, os anexos do feedback,
 * o prazo do aceite e a situação do aceite (aguardando, no prazo, não respondida, fora do prazo).
 */
export default function FeedbackNc({ nc, anexos = [], aoVisualizarAnexo }) {
  const feedback = nc.feedback_estruturado;
  if (!feedback) return null;
  const situacao = SITUACAO_ACEITE[situacaoDoAceite(nc)];

  return (
    <section className="sg-card" aria-labelledby="feedback-nc-titulo">
      <div className="sg-card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <h2 id="feedback-nc-titulo" className="h5 mb-0">Feedback</h2>
          <span className={`sg-badge ${situacao.classe}`}>{situacao.rotulo}</span>
        </div>
        <dl className="mb-0">
          <div className="sg-detalhe">
            <dt className="sg-detalhe__rotulo">Causa raiz</dt>
            <dd className="sg-detalhe__valor sg-texto-livre">{feedback.causa_raiz}</dd>
          </div>
          <div className="sg-detalhe">
            <dt className="sg-detalhe__rotulo">Ação combinada</dt>
            <dd className="sg-detalhe__valor sg-texto-livre">{feedback.acao_combinada}</dd>
          </div>
          <div className="sg-detalhe">
            <dt className="sg-detalhe__rotulo">Responsável pela ação</dt>
            <dd className="sg-detalhe__valor">{feedback.responsavel_acao_nome || "Não informado"}</dd>
          </div>
          <div className="sg-detalhe">
            <dt className="sg-detalhe__rotulo">Prazo da ação</dt>
            <dd className="sg-detalhe__valor">{feedback.prazo_acao ? formatarData(feedback.prazo_acao) : "Não informado"}</dd>
          </div>
          <div className="sg-detalhe">
            <dt className="sg-detalhe__rotulo">Combinado</dt>
            <dd className="sg-detalhe__valor sg-texto-livre">{feedback.combinado}</dd>
          </div>
          <div className="sg-detalhe">
            <dt className="sg-detalhe__rotulo">Prazo do aceite</dt>
            <dd className="sg-detalhe__valor">
              {formatarPrazo(feedback.prazo_aceite)}
              {nc.aceito_em && <span className="texto-secundario"> · aceito em {formatarDataHora(nc.aceito_em)}</span>}
            </dd>
          </div>
          <div className="sg-detalhe">
            <dt className="sg-detalhe__rotulo">Registrado por</dt>
            <dd className="sg-detalhe__valor">
              {feedback.registrado_por_nome || "-"} em {formatarDataHora(feedback.registrado_em)}
            </dd>
          </div>
          {anexos.length > 0 && (
            <div className="sg-detalhe">
              <dt className="sg-detalhe__rotulo">Anexos do feedback</dt>
              <dd className="sg-detalhe__valor">
                <ul className="list-unstyled mb-0">
                  {anexos.map((anexo) => (
                    <li key={anexo.id}>
                      {!anexo.url_temporaria ? anexo.nome_original : /\.(png|jpe?g|gif|webp)$/i.test(anexo.nome_original) ? (
                        <button
                          type="button"
                          className="sg-evidencia-item__link sg-evidencia-item__link--botao"
                          onClick={() => aoVisualizarAnexo?.(anexo)}
                        >
                          {anexo.nome_original}
                        </button>
                      ) : (
                        <a href={anexo.url_temporaria} target="_blank" rel="noopener noreferrer" className="sg-evidencia-item__link">
                          {anexo.nome_original}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
        {feedback.legado && (
          <p className="texto-xs texto-secundario mt-2 mb-0">Registro anterior a 10/2026: só o combinado foi informado na época.</p>
        )}
      </div>
    </section>
  );
}
