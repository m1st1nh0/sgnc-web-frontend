import { chamarApi } from "../../../lib/api/client/api.js";

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

export function buscarNcsDoIndicador(filtro, pagina = 0) {
  const params = new URLSearchParams({ ...filtro, pagina: String(pagina) });
  return chamarApi(`/insights/ncs?${params.toString()}`);
}
