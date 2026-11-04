/**
 * Regras dos anexos de evidência, compartilhadas entre o navegador e a API.
 *
 * O formulário avisa antes de enviar e a API valida de novo; as duas pontas
 * usam a mesma lista de formatos e o mesmo limite de tamanho.
 */

export const EXTENSOES_ANEXO = ["png", "jpg", "jpeg", "gif", "webp", "pdf", "doc", "docx", "xlsx"];
export const EXTENSOES_IMAGEM = ["png", "jpg", "jpeg", "gif", "webp"];
export const TAMANHO_MAXIMO_ANEXO = 15 * 1024 * 1024;

/** Valor do `accept` do campo de arquivo. */
export const FORMATOS_ANEXO = EXTENSOES_ANEXO.map((item) => `.${item}`).join(",");

export const MENSAGEM_FORMATO = `Tipo de arquivo não permitido. Aceitos: ${[...EXTENSOES_ANEXO].sort().map((item) => `.${item}`).join(", ")}`;

export function extensaoDoArquivo(nome) {
  const texto = String(nome ?? "");
  if (!texto.includes(".")) return "";
  return texto.split(".").pop().toLowerCase();
}

export const ehImagemAnexo = (nome) => EXTENSOES_IMAGEM.includes(extensaoDoArquivo(nome));

/** Problema do arquivo em texto claro, ou `null` quando ele pode ser enviado. */
export function problemaDoAnexo(arquivo) {
  if (!arquivo) return "Selecione um arquivo.";
  const extensao = extensaoDoArquivo(arquivo.name);
  if (!extensao || !EXTENSOES_ANEXO.includes(extensao)) return MENSAGEM_FORMATO;
  if (arquivo.size === 0) return `“${arquivo.name}” está vazio.`;
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) return `“${arquivo.name}” tem mais de 15 MB.`;
  return null;
}

/** Identidade do arquivo para não anexar o mesmo duas vezes. */
export const chaveDoAnexo = (arquivo) => `${arquivo.name}|${arquivo.size}|${arquivo.lastModified ?? 0}`;

/**
 * Junta novos arquivos aos já escolhidos: descarta duplicados e devolve os
 * problemas encontrados, para a tela mostrar uma mensagem só.
 */
export function juntarAnexos(atuais, novos) {
  const existentes = new Map((atuais ?? []).map((arquivo) => [chaveDoAnexo(arquivo), arquivo]));
  const problemas = [];
  const duplicados = [];
  const aceitos = [];
  for (const arquivo of novos ?? []) {
    const problema = problemaDoAnexo(arquivo);
    if (problema) { problemas.push(problema); continue; }
    const chave = chaveDoAnexo(arquivo);
    if (existentes.has(chave)) { duplicados.push(arquivo.name); continue; }
    existentes.set(chave, arquivo);
    aceitos.push(arquivo);
  }
  if (duplicados.length) {
    const nomes = [...new Set(duplicados)].join(", ");
    problemas.push(duplicados.length > 1 ? `Estes arquivos já estavam na lista: ${nomes}.` : `“${nomes}” já estava na lista.`);
  }
  return { arquivos: [...existentes.values()], aceitos, aviso: problemas.join(" ") };
}

/** Nome para a imagem colada da área de transferência, que vem sem nome útil. */
export function nomeDeImagemColada(arquivo, agora = new Date()) {
  const extensao = extensaoDoArquivo(arquivo?.name) || (arquivo?.type || "").split("/")[1] || "png";
  const carimbo = agora.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `imagem-colada-${carimbo}.${extensao === "jpeg" ? "jpg" : extensao}`;
}
