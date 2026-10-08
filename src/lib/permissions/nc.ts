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

type NcEvidencia = { status?: unknown; aberto_por?: unknown; colaborador_id?: unknown };

/** Anexo durante a triagem: Qualidade, quem registrou a NC ou o colaborador analisado. */
export function podeAnexarEvidencia(nc: NcEvidencia, user: UsuarioAutenticado) {
  if (nc.status !== "aberta") return false;
  return user.papel === "adm" || nc.aberto_por === user.id || nc.colaborador_id === user.id;
}

/** Remoção preserva a prova de quem registrou: Qualidade a qualquer momento, autor somente na triagem. */
export function podeExcluirEvidencia(nc: NcEvidencia, user: UsuarioAutenticado) {
  if (user.papel === "adm") return true;
  return nc.status === "aberta" && nc.aberto_por === user.id;
}
