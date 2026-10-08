/**
 * Contexto de retorno entre listas e o detalhe de uma NC.
 *
 * As listas enviam a própria URL (com filtros) em `?retorno=`; o detalhe usa
 * esse valor no link "Voltar". Só caminhos internos conhecidos são aceitos,
 * evitando redirecionamento aberto.
 */
const DESTINOS = [
  { prefixo: "/relatorios", rotulo: "Voltar para Relatórios" },
  { prefixo: "/insights", rotulo: "Voltar para Insights" },
  { prefixo: "/minhas-ncs", rotulo: "Voltar para Minhas NCs" },
  { prefixo: "/equipe/", rotulo: "Voltar para as NCs da pessoa" },
  { prefixo: "/equipe", rotulo: "Voltar para a equipe" },
  { prefixo: "/usuarios/", rotulo: "Voltar para o dossiê" },
  { prefixo: "/usuarios", rotulo: "Voltar para Usuários" },
];

function destinoDe(caminho) {
  return DESTINOS.find(({ prefixo }) => prefixo.endsWith("/")
    ? caminho.startsWith(prefixo)
    : caminho === prefixo || caminho.startsWith(`${prefixo}?`));
}

export function normalizarRetorno(valor, padrao = "/") {
  const caminho = Array.isArray(valor) ? valor[0] : valor;
  if (typeof caminho !== "string" || !caminho.startsWith("/") || caminho.startsWith("//") || caminho.includes("\\")) {
    return padrao;
  }
  return destinoDe(caminho) ? caminho : padrao;
}

export function rotuloRetorno(caminho) {
  return destinoDe(caminho)?.rotulo ?? "Voltar para a lista";
}

export function comRetorno(href, retorno) {
  if (!retorno) return href;
  const separador = href.includes("?") ? "&" : "?";
  return `${href}${separador}retorno=${encodeURIComponent(retorno)}`;
}

/** Monta a URL atual de uma lista a partir dos filtros não vazios. */
export function urlComFiltros(caminho, filtros) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "" && valor !== 0) params.set(chave, String(valor));
  });
  const query = params.toString();
  return query ? `${caminho}?${query}` : caminho;
}
