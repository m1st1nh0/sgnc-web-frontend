/**
 * Papéis do SGNC.
 *
 * - adm: Administrador do sistema. Gerencia usuários e acessos e tem também todos os
 *   poderes da Qualidade.
 * - qualidade: exercício pleno da função de Qualidade (NCs, causas, plano de ação,
 *   indicadores e montagem das equipes), sem gerenciar usuários e acessos.
 * - supervisor: liderança; enxerga apenas a própria hierarquia.
 * - funcionario: colaborador.
 */
export const PAPEIS = ["adm", "qualidade", "supervisor", "funcionario"];

export const NOME_PAPEL = {
  adm: "Administrador do sistema",
  qualidade: "Qualidade",
  supervisor: "Supervisor",
  funcionario: "Colaborador",
};

/** Exerce a função de Qualidade (o Administrador do sistema também exerce). */
export function ehQualidade(papel) {
  return papel === "adm" || papel === "qualidade";
}

/** Gerencia usuários, papéis e acessos. */
export function ehAdminSistema(papel) {
  return papel === "adm";
}

/**
 * Só membros da Diretoria ficam sem liderança (topo da estrutura). Todos os demais,
 * inclusive Qualidade e Administrador, respondem a alguém.
 */
export function precisaDeLideranca(pessoa) {
  return !pessoa?.diretoria;
}

/** Quem pode ser liderança de outra pessoa. */
export function podeLiderar(papel) {
  return papel === "supervisor" || ehQualidade(papel);
}
