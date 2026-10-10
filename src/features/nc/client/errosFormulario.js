/**
 * Apoio aos formulários de NC: resume os campos com erro no banner do topo
 * e leva o foco ao primeiro deles, na ordem em que aparecem na tela.
 */
export const ROTULOS_CAMPO = {
  colaborador: "Colaborador analisado",
  criticidade: "Criticidade",
  descricao: "Descrição",
  causas: "Causas",
};

/** Campos do feedback estruturado (Fase 4), na ordem do formulário. */
export const ROTULOS_CAMPO_FEEDBACK = {
  causa_raiz: "Causa raiz",
  acao_combinada: "Ação combinada",
  responsavel_acao: "Responsável pela ação",
  prazo_acao: "Prazo da ação",
  combinado: "Combinado",
};

/** `rotulos` define os campos e a ordem do formulário (padrão: abertura e edição de NC). */
export function camposComErro(erros, rotulos = ROTULOS_CAMPO) {
  return Object.keys(rotulos).filter((campo) => erros?.[campo]);
}

export function resumoErros(erros, rotulos = ROTULOS_CAMPO) {
  const campos = camposComErro(erros, rotulos);
  if (campos.length === 0) return "";
  return `Revise ${campos.length > 1 ? "os campos" : "o campo"}: ${campos.map((campo) => rotulos[campo]).join(", ")}.`;
}

/** `ids` mapeia o nome do campo para o id do elemento focável na tela. */
export function focarPrimeiroErro(erros, ids, rotulos = ROTULOS_CAMPO) {
  const primeiro = camposComErro(erros, rotulos).find((campo) => ids[campo]);
  if (!primeiro || typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const elemento = document.getElementById(ids[primeiro]);
    if (!elemento) return;
    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
    elemento.focus({ preventScroll: true });
  });
}
