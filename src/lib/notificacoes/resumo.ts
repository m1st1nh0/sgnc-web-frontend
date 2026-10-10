/** Ordem de gravidade dos níveis das notificações (lembretes sobem de nível). */
export const NIVEIS_NOTIFICACAO = ["normal", "atencao", "urgente", "critica"] as const;
export type NivelNotificacao = (typeof NIVEIS_NOTIFICACAO)[number];

type Notificacao = { nivel?: string | null; lida_em?: string | null; resolvida_em?: string | null; criada_em?: string | null; atualizada_em?: string | null };

/** Não lida e ainda pendente: conta no sino. */
export function ehPendente(notificacao: Notificacao) {
  return !notificacao.lida_em && !notificacao.resolvida_em;
}

/**
 * Contador do sino e cor pelo maior nível entre as não lidas e não resolvidas (5.6).
 * A lista vem com as não resolvidas primeiro e, dentro de cada grupo, as mais recentes primeiro.
 */
export function resumirNotificacoes<T extends Notificacao>(notificacoes: T[]) {
  const pendentes = notificacoes.filter(ehPendente);
  const indice = (nivel?: string | null) => Math.max(0, NIVEIS_NOTIFICACAO.indexOf((nivel ?? "normal") as NivelNotificacao));
  const maiorNivel = pendentes.reduce<NivelNotificacao | null>(
    (maior, item) => (maior === null || indice(item.nivel) > indice(maior) ? NIVEIS_NOTIFICACAO[indice(item.nivel)] : maior),
    null,
  );
  const recente = (item: T) => Date.parse(item.atualizada_em || item.criada_em || "") || 0;
  const itens = [...notificacoes].sort((a, b) => {
    if (!a.resolvida_em !== !b.resolvida_em) return a.resolvida_em ? 1 : -1;
    return recente(b) - recente(a);
  });
  return { itens, nao_lidas: pendentes.length, maior_nivel: maiorNivel };
}
