/**
 * Texto rico do SGNC: o relato com imagens no meio do texto.
 *
 * O conteúdo é guardado como um HTML bem pequeno e **validado por lista de
 * permissão**, nunca "limpo": se aparecer uma tag, um atributo ou um valor
 * fora da lista, o conteúdo é recusado com erro, em vez de o servidor tentar
 * adivinhar o que o navegador quis dizer. Isso vale tanto para o que vem do
 * editor quanto para o que volta do banco.
 *
 * As imagens não guardam endereço nenhum: ficam como `<img data-evidencia="12">`
 * e apontam para uma evidência da própria NC. Quem desenha a tela resolve o
 * id para a rota que serve o arquivo, já com a checagem de permissão de
 * sempre. Assim o texto não carrega URL assinada (que expira), nem base64
 * (que estoura o tamanho da coluna), e a imagem continua protegida.
 *
 * O arquivo não tem dependência de navegador nem de servidor: as duas pontas
 * usam a mesma regra.
 */

/** Tags aceitas e, para cada uma, os atributos aceitos. */
export const TAGS_PERMITIDAS = {
  p: [],
  br: [],
  strong: [],
  em: [],
  u: [],
  ul: [],
  ol: [],
  li: [],
  img: ["data-evidencia", "alt"],
};
const VAZIAS = new Set(["br", "img"]);
/** Tags que só podem aparecer dentro de uma lista. */
const SO_EM_LISTA = new Set(["li"]);

export const LIMITE_TEXTO_RICO = 60_000;

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const escaparTexto = (texto) => String(texto ?? "").replace(/[&<>"]/g, (char) => ENTIDADES[char]);

const DESESCAPAR = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const desescaparTexto = (texto) => String(texto ?? "").replace(
  /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
  (inteiro, corpo) => {
    if (corpo[0] !== "#") return DESESCAPAR[corpo.toLowerCase()] ?? inteiro;
    const codigo = corpo[1] === "x" || corpo[1] === "X" ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
    return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : inteiro;
  },
);

export class ErroTextoRico extends Error {}

const TOKEN = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\/?>/g;
const ATRIBUTO = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;

function lerAtributos(tag, bruto, pendentes) {
  const permitidos = TAGS_PERMITIDAS[tag];
  const atributos = {};
  const texto = String(bruto ?? "").trim();
  if (!texto) return atributos;
  // Qualquer coisa fora de `nome="valor"` (atributo sem aspas, evento, sobra) recusa o conteúdo.
  ATRIBUTO.lastIndex = 0;
  let achado;
  while ((achado = ATRIBUTO.exec(texto)) !== null) {
    const chave = achado[1].toLowerCase();
    if (!permitidos.includes(chave)) throw new ErroTextoRico(`O atributo "${chave}" não é aceito em <${tag}>.`);
    atributos[chave] = desescaparTexto(achado[2]);
  }
  const semAtributos = texto.replace(ATRIBUTO, "").trim();
  if (semAtributos) throw new ErroTextoRico(`Atributo mal formado em <${tag}>.`);
  if (tag === "img") {
    const id = Number(atributos["data-evidencia"]);
    // Id negativo é a imagem que ainda não virou evidência, enquanto a NC não
    // existe. A tela aceita (`pendentes`), para não travar o preenchimento; a
    // API nunca aceita, para não gravar imagem sem evidência.
    const valido = Number.isInteger(id) && (pendentes ? id !== 0 : id > 0);
    if (!valido) throw new ErroTextoRico("Imagem sem evidência correspondente.");
    atributos["data-evidencia"] = String(id);
  }
  return atributos;
}

/**
 * Lê o HTML e devolve a árvore de nós, ou lança `ErroTextoRico`.
 * Nós: `{ tipo: "texto", texto }` e `{ tipo: "elemento", tag, atributos, filhos }`.
 *
 * `pendentes` libera as imagens de id temporário (negativo), que só existem
 * no formulário aberto. A API chama sem essa opção.
 */
export function analisarTextoRico(html, { pendentes = false } = {}) {
  const texto = String(html ?? "");
  if (texto.length > LIMITE_TEXTO_RICO) throw new ErroTextoRico("O texto ficou grande demais. Reduza o conteúdo ou use menos imagens.");
  if (texto.includes("<!--") || texto.includes("<![")) throw new ErroTextoRico("Comentários não são aceitos no texto.");
  const raiz = { tipo: "elemento", tag: "#raiz", atributos: {}, filhos: [] };
  const pilha = [raiz];
  let posicao = 0;
  TOKEN.lastIndex = 0;
  let achado;
  const acrescentarTexto = (pedaco) => {
    if (!pedaco) return;
    if (pedaco.includes("<") || pedaco.includes(">")) throw new ErroTextoRico("Use &lt; e &gt; para sinais de menor e maior no texto.");
    pilha[pilha.length - 1].filhos.push({ tipo: "texto", texto: desescaparTexto(pedaco) });
  };
  while ((achado = TOKEN.exec(texto)) !== null) {
    acrescentarTexto(texto.slice(posicao, achado.index));
    posicao = achado.index + achado[0].length;
    const tag = achado[1].toLowerCase();
    const fechamento = achado[0].startsWith("</");
    if (!Object.hasOwn(TAGS_PERMITIDAS, tag)) throw new ErroTextoRico(`A marcação <${tag}> não é aceita no texto.`);
    if (fechamento) {
      if (achado[2].trim()) throw new ErroTextoRico(`Fechamento inválido de <${tag}>.`);
      const aberto = pilha[pilha.length - 1];
      if (aberto.tag !== tag) throw new ErroTextoRico(`A marcação <${tag}> foi fechada fora de ordem.`);
      pilha.pop();
      continue;
    }
    const no = { tipo: "elemento", tag, atributos: lerAtributos(tag, achado[2], pendentes), filhos: [] };
    if (SO_EM_LISTA.has(tag) && !["ul", "ol"].includes(pilha[pilha.length - 1].tag)) {
      throw new ErroTextoRico("Item de lista fora de uma lista.");
    }
    pilha[pilha.length - 1].filhos.push(no);
    if (!VAZIAS.has(tag)) pilha.push(no);
  }
  acrescentarTexto(texto.slice(posicao));
  if (pilha.length > 1) throw new ErroTextoRico(`A marcação <${pilha[pilha.length - 1].tag}> ficou aberta.`);
  return raiz.filhos;
}

/** `true` quando o conteúdo passa pela lista de permissão. */
export function textoRicoValido(html, opcoes) {
  try {
    analisarTextoRico(html, opcoes);
    return true;
  } catch {
    return false;
  }
}

/** Ids das evidências citadas no texto, na ordem em que aparecem. */
export function evidenciasDoTextoRico(html) {
  const ids = [];
  const visitar = (nos) => {
    for (const no of nos) {
      if (no.tipo !== "elemento") continue;
      if (no.tag === "img") ids.push(Number(no.atributos["data-evidencia"]));
      else visitar(no.filhos);
    }
  };
  visitar(analisarTextoRico(html));
  return ids;
}

/**
 * Versão em texto simples, para busca, listagens e relatórios.
 * Cada imagem vira "[imagem]", e parágrafos e itens viram quebras de linha.
 */
export function textoSimplesDoRico(html) {
  let saida = "";
  const visitar = (nos) => {
    for (const no of nos) {
      if (no.tipo === "texto") { saida += no.texto; continue; }
      if (no.tag === "img") { saida += "[imagem]"; continue; }
      if (no.tag === "br") { saida += "\n"; continue; }
      if (no.tag === "li") saida += "- ";
      visitar(no.filhos);
      if (["p", "li"].includes(no.tag)) saida += "\n";
    }
  };
  visitar(analisarTextoRico(html));
  return saida.replace(/\n{3,}/g, "\n\n").trim();
}

/** Texto simples virando texto rico: um parágrafo por linha, nada mais. */
export function textoRicoDeTextoSimples(texto) {
  const linhas = String(texto ?? "").split(/\r?\n/);
  const html = linhas.map((linha) => `<p>${escaparTexto(linha)}</p>`).join("");
  return html || "<p></p>";
}

/**
 * `true` quando o conteúdo tem alguma coisa além de espaços (imagem conta).
 * A tela chama com `pendentes`, porque na abertura as imagens ainda não viraram
 * evidência; sem isso, um print colado bloquearia o envio do formulário.
 */
export function textoRicoTemConteudo(html, opcoes) {
  try {
    const nos = analisarTextoRico(html, opcoes);
    let tem = false;
    const visitar = (lista) => {
      for (const no of lista) {
        if (tem) return;
        if (no.tipo === "texto") { if (no.texto.trim()) tem = true; continue; }
        if (no.tag === "img") { tem = true; return; }
        visitar(no.filhos);
      }
    };
    visitar(nos);
    return tem;
  } catch {
    return false;
  }
}

/**
 * Conteúdo como texto simples, venha ele em texto rico ou do formato antigo.
 * Os registros anteriores a esta mudança continuam sendo texto puro.
 */
export function comoTextoSimples(valor, formato) {
  if (formato !== "html") return String(valor ?? "");
  try {
    return textoSimplesDoRico(valor);
  } catch {
    // Conteúdo gravado fora da regra: mostra sem marcação, nunca como HTML.
    return String(valor ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

/**
 * Troca os ids temporários (negativos, usados enquanto a NC ainda não existe)
 * pelos ids reais das evidências já enviadas. Sem isso o conteúdo não passa na
 * validação, de propósito: imagem sem evidência não pode ser gravada.
 */
export function trocarEvidencias(html, mapa) {
  return String(html ?? "").replace(/<img data-evidencia="(-?\d+)"/g, (inteiro, id) => {
    const real = mapa instanceof Map ? mapa.get(Number(id)) : mapa?.[id];
    return real ? `<img data-evidencia="${Number(real)}"` : inteiro;
  });
}

/** Ids temporários que ainda faltam resolver no conteúdo. */
export function evidenciasPendentes(html) {
  const ids = [];
  for (const achado of String(html ?? "").matchAll(/<img data-evidencia="(-\d+)"/g)) ids.push(Number(achado[1]));
  return [...new Set(ids)];
}

/** Tira do texto as imagens ainda sem evidência real (ids temporários). */
export function removerEvidenciasPendentes(html) {
  return String(html ?? "").replace(/<img data-evidencia="-\d+"[^>]*>/g, "");
}

/**
 * Troca as imagens pendentes por "[imagem]" no texto com que a NC é criada.
 * A evidência só pode ser enviada depois que a NC existe, então a abertura
 * grava o relato com o marcador e o passo seguinte põe as imagens no lugar.
 * Usar marcador em vez de apagar evita que um relato só com print nasça vazio.
 */
export function marcarEvidenciasPendentes(html) {
  return String(html ?? "").replace(/<img data-evidencia="-\d+"[^>]*>/g, "[imagem]");
}
