import { API_BASE_URL } from "./config.js";

/**
 * Erro customizado para respostas de erro da API, guardando o
 * status HTTP e a mensagem que o FastAPI devolveu no campo "detail".
 */
export class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

function headersAutenticados() {
  const headers = {};
  const token = localStorage.getItem("sgnc_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function exigirRespostaOk(resposta) {
  if (resposta.ok) return;

  let mensagem = `Erro ${resposta.status}`;
  try {
    const dadosErro = await resposta.json();
    mensagem = dadosErro.detail || mensagem;
  } catch {
    // resposta sem corpo JSON; mantém a mensagem genérica
  }
  throw new ErroApi(mensagem, resposta.status);
}

/**
 * Função central que faz todas as chamadas JSON à API.
 * - Anexa automaticamente o token (se houver um salvo)
 * - Se o corpo for um objeto comum, converte para JSON
 * - Se o corpo for um FormData (upload de arquivo), manda como está
 * - Lança ErroApi em respostas de erro, já com a mensagem legível
 */
export async function chamarApi(caminho, { method = "GET", body, semAuth = false } = {}) {
  const headers = semAuth ? {} : headersAutenticados();
  let corpoFinal = undefined;

  if (body instanceof FormData) {
    corpoFinal = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    corpoFinal = JSON.stringify(body);
  }

  const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
    method,
    headers,
    body: corpoFinal,
  });

  await exigirRespostaOk(resposta);

  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : null;
}

/**
 * Faz download autenticado de arquivos binários sem expor o token na URL.
 * Retorna o Blob; a camada de UI decide o nome e dispara o salvamento local.
 */
export async function baixarArquivoApi(caminho) {
  const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
    method: "GET",
    headers: headersAutenticados(),
  });

  await exigirRespostaOk(resposta);
  return resposta.blob();
}
