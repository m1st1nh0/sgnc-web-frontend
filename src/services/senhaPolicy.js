export const SENHA_MINIMA = 10;

export function erroSenhaForte(senha) {
  const faltantes = [];
  if ((senha || "").length < SENHA_MINIMA) faltantes.push(`ao menos ${SENHA_MINIMA} caracteres`);
  if (!/[a-z]/.test(senha || "")) faltantes.push("uma letra minúscula");
  if (!/[A-Z]/.test(senha || "")) faltantes.push("uma letra maiúscula");
  if (!/\d/.test(senha || "")) faltantes.push("um número");
  if (!/[!@#$%^&*()_+\-=\[\]{};'\\:\"|<>?,./`~]/.test(senha || "")) faltantes.push("um símbolo");

  return faltantes.length
    ? `A senha deve conter ${faltantes.join(", ")}.`
    : "";
}

export const AJUDA_SENHA_FORTE =
  "10+ caracteres, com maiúscula, minúscula, número e símbolo.";
