/**
 * Classificação da NC na validação (Fase 2 do processo de gestão de NCs, decisões de 14/10/2026).
 * A Qualidade informa a origem (obrigatória), o tipo (cobrança ou orientativa) e, se quiser,
 * o procedimento descumprido e o link da intranet. A NC orientativa não conta para reincidência
 * nem para medida disciplinar.
 */
export const ORIGENS_NC = {
  monitoria: "Monitoria",
  auditoria: "Auditoria",
  supervisao: "Supervisão",
  indicador: "Indicador",
  reclamacao: "Reclamação validada",
};

export const TIPOS_NC = {
  cobranca: "Cobrança",
  orientativa: "Orientativa",
};

export const AJUDA_TIPO_NC = {
  cobranca: "Há procedimento a cobrar: conta para reincidência e medida disciplinar.",
  orientativa: "Sem procedimento formalizado a cobrar: orienta o colaborador e não conta para reincidência nem medida.",
};

const URL_VALIDA = /^https?:\/\/\S+$/i;

/** Valida a classificação enviada na validação. Devolve os valores limpos ou o primeiro erro com o campo. */
export function validarClassificacao(input = {}) {
  const origem = String(input.origem ?? "").trim();
  const tipo = String(input.tipo_nc ?? "").trim();
  const procedimento = String(input.procedimento ?? "").trim();
  const url = String(input.procedimento_url ?? "").trim();
  if (!Object.hasOwn(ORIGENS_NC, origem)) return { erro: { campo: "origem", mensagem: "Informe a origem da NC." } };
  if (!Object.hasOwn(TIPOS_NC, tipo)) return { erro: { campo: "tipo_nc", mensagem: "Marque a NC como cobrança ou orientativa." } };
  if (procedimento.length > 300) return { erro: { campo: "procedimento", mensagem: "Descreva o procedimento em até 300 caracteres." } };
  if (url && (!URL_VALIDA.test(url) || url.length > 500)) {
    return { erro: { campo: "procedimento_url", mensagem: "Informe um link começando com http:// ou https://." } };
  }
  return { valor: { origem, tipo_nc: tipo, procedimento: procedimento || null, procedimento_url: url || null } };
}
