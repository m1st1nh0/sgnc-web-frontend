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

const ORDEM_CAMPOS = Object.keys(ROTULOS_CAMPO);

export function camposComErro(erros) {
  return ORDEM_CAMPOS.filter((campo) => erros?.[campo]);
}

export function resumoErros(erros) {
  const campos = camposComErro(erros);
  if (campos.length === 0) return "";
  return `Revise ${campos.length > 1 ? "os campos" : "o campo"}: ${campos.map((campo) => ROTULOS_CAMPO[campo]).join(", ")}.`;
}

/** `ids` mapeia o nome do campo para o id do elemento focável na tela. */
export function focarPrimeiroErro(erros, ids) {
  const primeiro = camposComErro(erros).find((campo) => ids[campo]);
  if (!primeiro || typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const elemento = document.getElementById(ids[primeiro]);
    if (!elemento) return;
    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
    elemento.focus({ preventScroll: true });
  });
}
