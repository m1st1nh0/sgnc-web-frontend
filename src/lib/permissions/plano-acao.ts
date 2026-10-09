import type { UsuarioAutenticado } from "../auth/types";
import { ehQualidade } from "../auth/papeis";

/**
 * Regras de segregação de funções da NC crítica e do plano de ação.
 *
 * - A pessoa analisada (objeto da NC) nunca decide nada sobre a própria NC, mesmo que
 *   tenha papel de Qualidade ou liderança: não avalia, não dá feedback, não edita,
 *   não exclui, não marca como crítica, não alimenta e não aprova o plano.
 * - Marcar/desmarcar crítica e verificar a eficácia (concluir o plano): somente Qualidade.
 * - Alimentar o plano (planejamento, execução e acompanhamento): Qualidade e a liderança
 *   hierárquica do colaborador analisado.
 * - Quem executa as ações do plano não verifica a eficácia delas.
 *
 * As mesmas regras são repetidas nas funções SQL (defesa em profundidade).
 */

export type NcPlano = {
  status?: unknown;
  critica?: unknown;
  colaborador_id?: unknown;
  aberto_por?: unknown;
  responsavel_id?: unknown;
};

export type PlanoAcao = {
  status?: unknown;
  responsavel_execucao_id?: unknown;
} | null;

export const STATUS_PERMITEM_MARCAR_CRITICA = [
  "aguardando_feedback",
  "aguardando_analise",
  "validada",
  "aguardando_aceite",
  "concluida",
] as const;

export const ETAPAS_PLANO_EDITAVEIS = ["planejamento", "em_execucao", "em_acompanhamento"] as const;

export function ehObjetoDaNc(nc: NcPlano, user: UsuarioAutenticado) {
  return !!nc.colaborador_id && nc.colaborador_id === user.id;
}

/** Ações reservadas à Qualidade sobre a NC (avaliar, feedback, editar, excluir, medidas). */
export function podeAtuarComoQualidade(nc: NcPlano, user: UsuarioAutenticado) {
  return ehQualidade(user.papel) && !ehObjetoDaNc(nc, user);
}

function planoEncerrado(plano: PlanoAcao) {
  return !!plano && (plano.status === "concluido" || plano.status === "cancelado");
}

export function podeMarcarCritica(nc: NcPlano, user: UsuarioAutenticado) {
  return podeAtuarComoQualidade(nc, user)
    && nc.critica !== true
    && (STATUS_PERMITEM_MARCAR_CRITICA as readonly unknown[]).includes(nc.status);
}

export function podeDesmarcarCritica(nc: NcPlano, plano: PlanoAcao, user: UsuarioAutenticado) {
  return podeAtuarComoQualidade(nc, user) && nc.critica === true && plano?.status !== "concluido";
}

/** `lideraColaborador` deve vir da hierarquia validada no servidor, nunca do cliente. */
export function podeAlimentarPlano(
  nc: NcPlano,
  plano: PlanoAcao,
  user: UsuarioAutenticado,
  lideraColaborador: boolean,
) {
  if (nc.critica !== true || !plano || planoEncerrado(plano)) return false;
  if (ehObjetoDaNc(nc, user)) return false;
  return ehQualidade(user.papel) || (user.papel === "supervisor" && lideraColaborador);
}

export function podeConcluirPlano(nc: NcPlano, plano: PlanoAcao, user: UsuarioAutenticado) {
  return podeAtuarComoQualidade(nc, user)
    && nc.critica === true
    && nc.status === "em_plano_acao"
    && plano?.status === "em_acompanhamento"
    && plano.responsavel_execucao_id !== user.id;
}

/**
 * Leitura do plano: Qualidade, liderança do colaborador, o próprio colaborador (transparência,
 * somente leitura) e o responsável pela execução. Quem apenas registrou a NC não vê o plano.
 */
export function podeVerPlano(
  nc: NcPlano,
  plano: PlanoAcao,
  user: UsuarioAutenticado,
  lideraColaborador: boolean,
) {
  if (ehQualidade(user.papel)) return true;
  if (ehObjetoDaNc(nc, user)) return true;
  if (user.papel === "supervisor" && lideraColaborador) return true;
  return !!plano && plano.responsavel_execucao_id === user.id;
}

export function permissoesPlano(
  nc: NcPlano,
  plano: PlanoAcao,
  user: UsuarioAutenticado,
  lideraColaborador: boolean,
) {
  return {
    marcar_critica: podeMarcarCritica(nc, user),
    desmarcar_critica: podeDesmarcarCritica(nc, plano, user),
    alimentar_plano: podeAlimentarPlano(nc, plano, user, lideraColaborador),
    concluir_plano: podeConcluirPlano(nc, plano, user),
  };
}
