import type { UsuarioAutenticado } from "../auth/types";

export function filterSensitive(nc: Record<string, unknown>, user: UsuarioAutenticado) {
  const isAuthor = nc.aberto_por === user.id;
  const complete =
    user.papel === "adm" ||
    user.papel === "supervisor" ||
    nc.colaborador_id === user.id ||
    nc.responsavel_id === user.id;
  if (isAuthor && !complete) {
    return {
      ...nc,
      motivo_invalidacao: null,
      feedback: null,
      texto_aceite: null,
      validado_em: null,
      feedback_aplicado_em: null,
      aceito_em: null,
    };
  }
  return nc;
}
