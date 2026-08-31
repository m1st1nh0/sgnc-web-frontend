/**
 * Fonte única de verdade para a apresentação dos status da NC.
 * `etapa` conecta o estado de negócio aos tokens visuais sem alterar a API.
 */
export const STATUS_INFO = {
  aberta: { rotulo: "Aberta", cor: "secondary", etapa: "aberta" },
  invalidada: { rotulo: "Invalidada", cor: "danger", etapa: "invalidada" },
  aguardando_feedback: { rotulo: "Aguardando feedback", cor: "warning", etapa: "aguardando-feedback" },
  aguardando_aceite: { rotulo: "Aguardando aceite", cor: "warning", etapa: "aguardando-aceite" },
  concluida: { rotulo: "Concluída", cor: "success", etapa: "concluida" },
  validada: { rotulo: "Validada (legado)", cor: "info", etapa: "validada" },
  aguardando_analise: { rotulo: "Aguardando feedback", cor: "warning", etapa: "aguardando-analise" },
};

export function infoDoStatus(status) {
  return STATUS_INFO[status] ?? {
    rotulo: status,
    cor: "secondary",
    etapa: "aberta",
  };
}
