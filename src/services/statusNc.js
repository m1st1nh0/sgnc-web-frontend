/**
 * Fonte única de verdade para como cada status de NC é exibido.
 * Os status marcados como legado permanecem durante o rollout para que
 * registros antigos continuem legíveis até a migração do banco.
 */
export const STATUS_INFO = {
  aberta: { rotulo: "Aberta", cor: "secondary" },
  invalidada: { rotulo: "Invalidada", cor: "danger" },
  aguardando_feedback: { rotulo: "Aguardando feedback", cor: "warning" },
  aguardando_aceite: { rotulo: "Aguardando aceite", cor: "warning" },
  concluida: { rotulo: "Concluída", cor: "success" },
  validada: { rotulo: "Validada (legado)", cor: "info" },
  aguardando_analise: { rotulo: "Aguardando feedback", cor: "warning" },
};

export function infoDoStatus(status) {
  return STATUS_INFO[status] ?? { rotulo: status, cor: "secondary" };
}
