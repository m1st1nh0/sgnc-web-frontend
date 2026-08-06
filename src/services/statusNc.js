/**
 * Fonte única de verdade para como cada status de NC é exibido:
 * rótulo em português legível + cor do badge (Bootstrap).
 * Usado tanto na lista quanto na tela de detalhes, para não
 * duplicar (e arriscar desalinhar) essa informação em dois lugares.
 */
export const STATUS_INFO = {
  aberta: { rotulo: "Aberta", cor: "secondary" },
  invalidada: { rotulo: "Invalidada", cor: "danger" },
  validada: { rotulo: "Validada", cor: "info" },
  aguardando_analise: { rotulo: "Aguardando análise", cor: "warning" },
  aguardando_aceite: { rotulo: "Aguardando aceite", cor: "warning" },
  concluida: { rotulo: "Concluída", cor: "success" },
};

export function infoDoStatus(status) {
  return STATUS_INFO[status] ?? { rotulo: status, cor: "secondary" };
}
