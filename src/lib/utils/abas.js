/**
 * Estado das abas internas dos módulos.
 *
 * Cada módulo visível no menu pode virar uma aba. A aba guarda a última rota
 * visitada dentro do módulo (com filtros e paginação, que ficam na URL), então
 * clicar na aba devolve o usuário exatamente onde ele parou. Telas de detalhe
 * (ex.: `/nc/12`) não abrem aba própria: elas pertencem à aba ativa, que passa
 * a apontar para elas.
 *
 * As funções deste arquivo são puras (exceto a leitura/gravação explícita no
 * localStorage) para que a regra das abas possa ser testada sem navegador.
 */

const PREFIXO = "sgnc-abas:";
const LIMITE = 12;

/** Normaliza a URL guardada na aba: só caminho e query, sempre começando com "/". */
export function normalizarUrl(url) {
  const texto = String(url ?? "").trim();
  if (!texto.startsWith("/")) return "/";
  return texto.replace(/#.*$/, "") || "/";
}

const caminhoDaUrl = (url) => normalizarUrl(url).split("?")[0];

/** @typedef {{ href: string, label: string, icon: string }} Modulo */
/** @typedef {Modulo & { url: string }} Aba */

/**
 * Qual módulo responde por uma rota. Casa pelo caminho exato ou por prefixo
 * (`/equipe/123` é do módulo `/equipe`); o módulo mais específico ganha.
 */
/**
 * @param {unknown} url
 * @param {Modulo[]} modulos
 * @returns {Modulo | null}
 */
export function moduloDaRota(url, modulos) {
  const caminho = caminhoDaUrl(url);
  /** @type {Modulo | null} */
  let encontrado = null;
  for (const modulo of modulos ?? []) {
    const href = caminhoDaUrl(modulo.href);
    const casa = caminho === href || (href !== "/" && caminho.startsWith(`${href}/`));
    if (!casa) continue;
    if (!encontrado || href.length > caminhoDaUrl(encontrado.href).length) encontrado = modulo;
  }
  return encontrado;
}

/** Descarta abas de módulos que não existem mais ou que o perfil não acessa, e duplicatas. */
/**
 * @param {unknown} abas
 * @param {Modulo[]} modulos
 * @returns {Aba[]}
 */
export function normalizarAbas(abas, modulos) {
  const vistos = new Set();
  /** @type {Aba[]} */
  const validas = [];
  for (const aba of Array.isArray(abas) ? abas : []) {
    const modulo = (modulos ?? []).find((item) => item.href === aba?.href);
    if (!modulo || vistos.has(modulo.href)) continue;
    vistos.add(modulo.href);
    const url = normalizarUrl(aba.url || modulo.href);
    // A URL guardada tem de continuar dentro do módulo da aba.
    const dentro = moduloDaRota(url, modulos)?.href === modulo.href;
    validas.push({ href: modulo.href, label: modulo.label, icon: modulo.icon, url: dentro ? url : modulo.href });
  }
  return validas.slice(-LIMITE);
}

/**
 * Aplica a rota atual às abas: abre a aba do módulo (uma só por módulo) ou,
 * quando a rota não tem módulo, atualiza a aba ativa. Devolve as abas e o href
 * da aba ativa.
 */
/**
 * @param {unknown} abas
 * @param {{ url: unknown, modulos: Modulo[], ativaAtual?: string | null }} contexto
 * @returns {{ abas: Aba[], ativa: string | null }}
 */
export function aplicarRota(abas, { url, modulos, ativaAtual = null }) {
  const lista = normalizarAbas(abas, modulos);
  const destino = normalizarUrl(url);
  const modulo = moduloDaRota(destino, modulos);
  if (!modulo) {
    // Rota fora dos módulos (ex.: /trocar-senha): mantém as abas como estão.
    const ativa = lista.some((aba) => aba.href === ativaAtual) ? ativaAtual : null;
    return { abas: lista, ativa };
  }
  const indice = lista.findIndex((aba) => aba.href === modulo.href);
  const aba = { href: modulo.href, label: modulo.label, icon: modulo.icon, url: destino };
  if (indice === -1) return { abas: [...lista, aba].slice(-LIMITE), ativa: modulo.href };
  const atualizadas = lista.map((item, i) => (i === indice ? aba : item));
  return { abas: atualizadas, ativa: modulo.href };
}

/**
 * Fecha uma aba. Devolve as abas restantes e para onde navegar: a aba seguinte
 * (ou a anterior, quando a fechada era a última) se a fechada estava ativa, ou
 * `null` quando não é preciso navegar. Sem abas restantes, volta para "/".
 */
/**
 * @param {Aba[]} abas
 * @param {string} href
 * @param {string | null} [ativa]
 * @returns {{ abas: Aba[], destino: string | null }}
 */
export function fecharAba(abas, href, ativa) {
  const indice = abas.findIndex((aba) => aba.href === href);
  if (indice === -1) return { abas, destino: null };
  const restantes = abas.filter((aba) => aba.href !== href);
  if (href !== ativa) return { abas: restantes, destino: null };
  if (!restantes.length) return { abas: restantes, destino: "/" };
  const proxima = restantes[Math.min(indice, restantes.length - 1)];
  return { abas: restantes, destino: proxima.url };
}

/** Escopos de rascunho que uma rota pode ter, para avisar antes de fechar a aba. */
export function escoposDeRascunho(url) {
  const caminho = caminhoDaUrl(url);
  if (caminho === "/abrir-nc") return ["abrir-nc"];
  const nc = caminho.match(/^\/nc\/(\d+)(\/editar)?$/);
  if (nc) return nc[2] ? [`editar-nc:${nc[1]}`] : [`feedback-nc:${nc[1]}`];
  return [];
}

function armazenamento() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Abas guardadas do usuário; volta vazio quando não há armazenamento. */
/** @returns {Aba[]} */
export function lerAbas(usuarioId) {
  if (!usuarioId) return [];
  try {
    const bruto = armazenamento()?.getItem(`${PREFIXO}${usuarioId}`);
    const salvo = bruto == null ? null : JSON.parse(bruto);
    return Array.isArray(salvo) ? salvo : [];
  } catch {
    return [];
  }
}

export function gravarAbas(usuarioId, abas) {
  if (!usuarioId) return;
  try {
    armazenamento()?.setItem(`${PREFIXO}${usuarioId}`, JSON.stringify(abas));
  } catch {
    // Sem espaço ou sem armazenamento: as abas valem só para esta sessão.
  }
}

export function limparAbas(usuarioId) {
  try {
    if (usuarioId) armazenamento()?.removeItem(`${PREFIXO}${usuarioId}`);
  } catch {
    // Nada a limpar.
  }
}
