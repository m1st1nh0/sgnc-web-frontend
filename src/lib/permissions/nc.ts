import type { UsuarioAutenticado } from "../auth/types";
import { ehQualidade } from "../auth/papeis";

/**
 * Acesso completo à NC: Qualidade, o colaborador analisado, quem decidiu a NC e a liderança
 * hierárquica do colaborador. Um supervisor que apenas registrou a NC de alguém fora da
 * própria equipe recebe a mesma visão resumida de qualquer outro autor.
 */
export function temAcessoCompleto(
  nc: Record<string, unknown>,
  user: UsuarioAutenticado,
  equipeIds: ReadonlySet<string> = new Set(),
) {
  return ehQualidade(user.papel)
    || nc.colaborador_id === user.id
    || nc.responsavel_id === user.id
    || (user.papel === "supervisor" && typeof nc.colaborador_id === "string" && equipeIds.has(nc.colaborador_id));
}

export function filterSensitive(
  nc: Record<string, unknown>,
  user: UsuarioAutenticado,
  equipeIds: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const complete = temAcessoCompleto(nc, user, equipeIds);
  if (!complete) {
    return {
      ...nc,
      acesso_completo: false,
      motivo_invalidacao: null,
      feedback: null,
      texto_aceite: null,
      validado_em: null,
      feedback_aplicado_em: null,
      aceito_em: null,
      critica_motivo: null,
      critica_marcada_por: null,
    };
  }
  return { ...nc, acesso_completo: true };
}

type NcEvidencia = { status?: unknown; aberto_por?: unknown; colaborador_id?: unknown };

/** Anexo durante a triagem: Qualidade, quem registrou a NC ou o colaborador analisado. */
export function podeAnexarEvidencia(nc: NcEvidencia, user: UsuarioAutenticado) {
  if (nc.status !== "aberta") return false;
  return ehQualidade(user.papel) || nc.aberto_por === user.id || nc.colaborador_id === user.id;
}

/**
 * Remoção preserva a prova de quem registrou: Qualidade a qualquer momento, autor somente na triagem.
 * O colaborador analisado nunca remove evidências da própria NC, mesmo sendo da Qualidade.
 */
export function podeExcluirEvidencia(nc: NcEvidencia, user: UsuarioAutenticado) {
  if (nc.colaborador_id === user.id) return false;
  if (ehQualidade(user.papel)) return true;
  return nc.status === "aberta" && nc.aberto_por === user.id;
}
