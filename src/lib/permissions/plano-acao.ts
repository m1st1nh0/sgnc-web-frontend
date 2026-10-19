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
  plano_acao_aberto?: unknown;
  escalada_para?: unknown;
};

/** NC com plano de ação: a crítica (obrigatório) ou a que teve plano aberto pela Qualidade (Fase 5). */
export function temPlano(nc: NcPlano) {
  return nc.critica === true || nc.plano_acao_aberto === true;
}

/** Status de NC validada e ainda não concluída em que a Qualidade pode abrir o plano (N1). */
export const STATUS_PERMITEM_ABRIR_PLANO = ["aguardando_feedback", "aguardando_analise", "aguardando_aceite", "nao_respondida"] as const;

export type PlanoAcao = {
  status?: unknown;
  responsavel_execucao_id?: unknown;
} | null;

export const STATUS_PERMITEM_MARCAR_CRITICA = [
  "aguardando_feedback",
  "aguardando_analise",
  "validada",
  "aguardando_aceite",
  "nao_respondida",
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
  if (!temPlano(nc) || !plano || planoEncerrado(plano)) return false;
  if (ehObjetoDaNc(nc, user)) return false;
  return ehQualidade(user.papel) || (user.papel === "supervisor" && lideraColaborador);
}

export function podeConcluirPlano(nc: NcPlano, plano: PlanoAcao, user: UsuarioAutenticado) {
  return podeAtuarComoQualidade(nc, user)
    && temPlano(nc)
    && (nc.status === "em_plano_acao" || nc.status === "reaberta")
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
  if (!!nc.escalada_para && nc.escalada_para === user.id) return true;
  return !!plano && plano.responsavel_execucao_id === user.id;
}

export function podeAbrirPlano(nc: NcPlano, user: UsuarioAutenticado) {
  return podeAtuarComoQualidade(nc, user) && !temPlano(nc)
    && (STATUS_PERMITEM_ABRIR_PLANO as readonly unknown[]).includes(nc.status);
}

/** Verificação de eficácia: Qualidade sem conflito, e nunca quem executou o plano. */
export function podeRegistrarVerificacao(nc: NcPlano, plano: PlanoAcao, user: UsuarioAutenticado) {
  return podeAtuarComoQualidade(nc, user) && nc.status === "em_verificacao" && plano?.responsavel_execucao_id !== user.id;
}

export function podeDecidirNaoEficaz(nc: NcPlano, user: UsuarioAutenticado) {
  return podeAtuarComoQualidade(nc, user) && nc.status === "nao_eficaz";
}

/** Só o gestor do departamento que recebeu a NC escalada registra o parecer. */
export function podeDecidirEscalonamento(nc: NcPlano, user: UsuarioAutenticado) {
  return nc.status === "escalada" && !ehObjetoDaNc(nc, user) && !!nc.escalada_para && nc.escalada_para === user.id;
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
    abrir_plano: podeAbrirPlano(nc, user),
    registrar_verificacao: podeRegistrarVerificacao(nc, plano, user),
    decidir_nao_eficaz: podeDecidirNaoEficaz(nc, user),
    decidir_escalonamento: podeDecidirEscalonamento(nc, user),
  };
}
