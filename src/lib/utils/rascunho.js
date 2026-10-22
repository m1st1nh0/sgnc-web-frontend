/**
 * Rascunhos de formulário guardados na aba (sessionStorage).
 *
 * O usuário troca de módulo em qualquer ordem; o que ele digitou volta quando
 * a tela é aberta de novo, mesmo depois de sair dela por várias telas ou de a
 * sessão expirar. Cada valor fica em `sgnc-rascunho:<escopo>:<campo>` e só é
 * gravado enquanto difere do valor inicial. Os rascunhos pertencem a um
 * usuário: outro login na mesma aba começa limpo.
 */
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const PREFIXO = "sgnc-rascunho:";
const CHAVE_DONO = "sgnc-rascunho-dono";

function armazenamento() {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function chavesComPrefixo(prefixo) {
  const s = armazenamento();
  if (!s) return [];
  const chaves = [];
  for (let i = 0; i < s.length; i += 1) {
    const chave = s.key(i);
    if (chave?.startsWith(prefixo)) chaves.push(chave);
  }
  return chaves;
}

function ler(chave) {
  try {
    const bruto = armazenamento()?.getItem(chave);
    return bruto == null ? undefined : JSON.parse(bruto);
  } catch {
    return undefined;
  }
}

function gravar(chave, valor, inicial) {
  const s = armazenamento();
  if (!s) return;
  try {
    const serializado = JSON.stringify(valor);
    if (serializado === JSON.stringify(inicial)) s.removeItem(chave);
    else s.setItem(chave, serializado);
  } catch {
    // Sem espaço ou sem armazenamento: o valor continua só na memória.
  }
}

/** Associa os rascunhos da aba ao usuário logado; troca de usuário descarta os anteriores. */
export function prepararRascunhos(usuarioId) {
  const s = armazenamento();
  if (!s || !usuarioId) return;
  try {
    if (s.getItem(CHAVE_DONO) !== String(usuarioId)) {
      limparTodosRascunhos();
      s.setItem(CHAVE_DONO, String(usuarioId));
    }
  } catch {
    // Sem armazenamento, não há rascunho para proteger.
  }
}

/** Remove todos os rascunhos (ao sair do sistema). */
export function limparTodosRascunhos() {
  const s = armazenamento();
  for (const chave of chavesComPrefixo(PREFIXO)) s?.removeItem(chave);
}

/** Remove os rascunhos de um escopo, por exemplo depois de enviar o formulário. */
export function limparRascunho(escopo) {
  const s = armazenamento();
  for (const chave of chavesComPrefixo(`${PREFIXO}${escopo}:`)) s?.removeItem(chave);
}

/** Indica se há algo digitado e não enviado no escopo. */
export function existeRascunho(escopo) {
  return chavesComPrefixo(`${PREFIXO}${escopo}:`).length > 0;
}

/**
 * Igual a `useState`, mas o valor sobrevive à troca de tela. Sem `escopo`
 * (ex.: id ainda não carregado) funciona como `useState` comum. Use só com
 * valores serializáveis em JSON (nada de `File`).
 *
 * O terceiro item, `definirBase`, serve para valores vindos do servidor (ex.:
 * edição): vira a nova referência e só aparece se não houver rascunho do campo.
 */
export function useRascunho(escopo, campo, inicial) {
  const chave = escopo ? `${PREFIXO}${escopo}:${campo}` : null;
  const [valor, setValor] = useState(inicial);
  const base = useRef(inicial);
  const chaveRestaurada = useRef(undefined);

  // Restaura só quando a chave muda; ao reexibir a tela oculta o estado já está certo.
  useLayoutEffect(() => {
    if (chaveRestaurada.current === chave) return;
    const primeira = chaveRestaurada.current === undefined;
    chaveRestaurada.current = chave;
    const salvo = chave ? ler(chave) : undefined;
    // O sessionStorage não existe no servidor; ler no render quebraria a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (salvo !== undefined) setValor(salvo);
    else if (!primeira) setValor(base.current);
  }, [chave]);

  const atualizar = useCallback(
    (proximo) => {
      setValor((anterior) => {
        const novo = typeof proximo === "function" ? proximo(anterior) : proximo;
        if (chave) gravar(chave, novo, base.current);
        return novo;
      });
    },
    [chave, base]
  );

  const definirBase = useCallback(
    (novo) => {
      base.current = novo;
      if (!chave || ler(chave) === undefined) setValor(novo);
    },
    [chave, base]
  );

  return [valor, atualizar, definirBase];
}
