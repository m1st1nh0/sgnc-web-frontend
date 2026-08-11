/**
 * Paleta de cores usada nos gráficos da página de Insights.
 * Valores pensados para combinar com os tokens do design system
 * (src/index.css) e com os nomes de cores do Bootstrap usados
 * pelo BadgeStatus (secundary/info/warning/success/danger/primary).
 */
export const CORES_GRAFICO = {
  azul: "#2563eb",
  azulClaro: "#60a5fa",
  verde: "#16a34a",
  amarelo: "#d97706",
  laranja: "#ea580c",
  vermelho: "#dc2626",
  ciano: "#0891b2",
  violeta: "#7c3aed",
  cinza: "#94a3b8",
};

/** Traduz a cor do badge de status (ver statusNc.js) para hex dos gráficos. */
export const COR_HEX_STATUS = {
  primary: CORES_GRAFICO.azul,
  secondary: CORES_GRAFICO.cinza,
  info: CORES_GRAFICO.azulClaro,
  warning: CORES_GRAFICO.amarelo,
  success: CORES_GRAFICO.verde,
  danger: CORES_GRAFICO.vermelho,
};