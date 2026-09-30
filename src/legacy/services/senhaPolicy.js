export const SENHA_MINIMA = 10;
const SIMBOLOS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~';

export function erroSenhaForte(senha) {
  const valor = senha || "";
  const faltantes = [];
  if (valor.length < SENHA_MINIMA) faltantes.push(`ao menos ${SENHA_MINIMA} caracteres`);
  if (!/[a-z]/.test(valor)) faltantes.push("uma letra minúscula");
  if (!/[A-Z]/.test(valor)) faltantes.push("uma letra maiúscula");
  if (!/\d/.test(valor)) faltantes.push("um número");
  if (![...valor].some((caractere) => SIMBOLOS.includes(caractere))) faltantes.push("um símbolo");

  return faltantes.length
    ? `A senha deve conter ${faltantes.join(", ")}.`
    : "";
}

export const AJUDA_SENHA_FORTE =
  "10+ caracteres, com maiúscula, minúscula, número e símbolo.";
