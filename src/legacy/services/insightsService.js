import { chamarApi } from "./api";

/**
 * Busca os dados consolidados da página de Insights.
 *
 * O endpoint GET /insights precisa estar implementado no backend
 * conforme o contrato em docs/insights-endpoint.md.
 *
 * @param {object} opcoes - { inicio, fim } datas ISO (YYYY-MM-DD) opcionais.
 *   Sem parâmetros, o backend retorna os últimos 12 meses.
 */
export function buscarInsights({ inicio, fim } = {}) {
  const params = new URLSearchParams();
  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);
  const query = params.toString();
  return chamarApi(`/insights${query ? `?${query}` : ""}`);
}