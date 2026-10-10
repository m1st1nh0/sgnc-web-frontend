/**
 * Status que contam como ocorrência para reincidência: NC validada em qualquer etapa seguinte.
 * Mesma lista de validar_nc_com_ocorrencias_v2 (D14: "Não respondida" conta; em 10/10 também
 * "Em plano de ação"). Aberta e invalidada não contam.
 */
export const STATUS_CONTAM_OCORRENCIA = [
  "validada",
  "aguardando_analise",
  "aguardando_feedback",
  "aguardando_aceite",
  "nao_respondida",
  "em_plano_acao",
  "concluida",
] as const;

/** Início da janela de 12 meses (igual a `data - interval '12 months'` no Postgres). */
export function inicioJanelaReincidencia(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano - 1, mes, 0)).getUTCDate();
  const diaAjustado = Math.min(dia, ultimoDia);
  return `${ano - 1}-${String(mes).padStart(2, "0")}-${String(diaAjustado).padStart(2, "0")}`;
}

export type SituacaoAceite = "aguardando" | "no_prazo" | "fora_prazo" | "nao_respondida" | "sem_feedback";

export function situacaoDoAceite(nc: { status?: unknown; aceito_em?: unknown; aceito_fora_prazo?: unknown }): SituacaoAceite {
  if (nc.status === "nao_respondida") return "nao_respondida";
  if (nc.aceito_em) return nc.aceito_fora_prazo === true ? "fora_prazo" : "no_prazo";
  if (nc.status === "aguardando_aceite") return "aguardando";
  return "sem_feedback";
}

type NcAnterior = { id: number; data: string; status: string; aceito_em?: string | null; aceito_fora_prazo?: boolean | null };
type Relacao = { nc_id: number; causa_id: number };
type Feedback = { nc_id: number; versao: number; causa_raiz: string; acao_combinada: string };

/**
 * NCs anteriores do mesmo colaborador com alguma das causas da NC atual, mais recentes primeiro,
 * com o que foi combinado em cada uma (último feedback) e a situação do aceite.
 */
export function montarAnteriores(
  ncs: NcAnterior[],
  relacoes: Relacao[],
  feedbacks: Feedback[],
  nomesCausas: Map<number, string>,
) {
  const causasPorNc = new Map<number, string[]>();
  for (const relacao of relacoes) {
    const nome = nomesCausas.get(relacao.causa_id);
    if (!nome) continue;
    causasPorNc.set(relacao.nc_id, [...(causasPorNc.get(relacao.nc_id) ?? []), nome]);
  }
  const ultimoFeedback = new Map<number, Feedback>();
  for (const feedback of feedbacks) {
    const atual = ultimoFeedback.get(feedback.nc_id);
    if (!atual || feedback.versao > atual.versao) ultimoFeedback.set(feedback.nc_id, feedback);
  }
  return ncs
    .filter((nc) => causasPorNc.has(nc.id))
    .sort((a, b) => (a.data === b.data ? b.id - a.id : a.data < b.data ? 1 : -1))
    .map((nc) => ({
      id: nc.id,
      data: nc.data,
      status: nc.status,
      causas: [...new Set(causasPorNc.get(nc.id))].sort(),
      causa_raiz: ultimoFeedback.get(nc.id)?.causa_raiz ?? null,
      acao_combinada: ultimoFeedback.get(nc.id)?.acao_combinada ?? null,
      aceite: situacaoDoAceite(nc),
    }));
}
