import { ApiError } from "@/lib/api/error";

export function chaveCatalogoCausa(descricao: string) {
  return descricao.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/**
 * Confere as causas informadas contra o catálogo, na ordem recebida.
 * Função pura para teste: recebe as linhas já buscadas no banco.
 */
export function resolverCausasDoCatalogo(
  causas: string[],
  catalogo: Array<{ id: number; ativo: boolean; descricao_normalizada: string }>,
  options: { allowInactive?: boolean } = {},
) {
  const porDescricao = new Map(catalogo.map((item) => [item.descricao_normalizada, item]));
  return causas.map((descricao) => {
    const existing = porDescricao.get(chaveCatalogoCausa(descricao));
    if (!existing) {
      throw new ApiError(`A causa “${descricao}” não está no catálogo. Selecione uma causa da lista ou cadastre-a em Gestão de causas.`, 422, "causas");
    }
    if (!existing.ativo && !options.allowInactive) {
      throw new ApiError(`A causa “${descricao}” está arquivada. Solicite sua reativação à Qualidade.`, 422, "causas");
    }
    return existing.id;
  });
}

/** Lista para o filtro `in` do PostgREST, com aspas e escape (causas podem ter vírgula, parênteses ou aspas). */
export function listaFiltroIn(valores: string[]) {
  return `(${valores.map((valor) => `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`;
}
