import { API_BASE_URL } from "./config.js";

export const EVENTO_SESSAO_EXPIRADA = "sgnc:sessao-expirada";

function encerrarSessaoLocal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA));
}

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

async function exigirRespostaOk(resposta) {
  if (resposta.ok) return;

  let mensagem = `Erro ${resposta.status}`;
  try {
    const dadosErro = await resposta.json();
    mensagem = dadosErro.detail || mensagem;
  } catch {
    // resposta sem corpo JSON; mantém a mensagem genérica
  }

  if (resposta.status === 401) {
    encerrarSessaoLocal();
  }

  throw new ErroApi(mensagem, resposta.status);
}

/**
 * Função central para chamadas JSON à rota same-origin. O Route Handler
 * valida a sessão Supabase e encaminha o token ao FastAPI no servidor.
 * Objetos viram JSON e FormData segue sem reserialização.
 */
export async function chamarApi(caminho, { method = "GET", body } = {}) {
  const headers = {};
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
    credentials: "same-origin",
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
    headers: {},
    credentials: "same-origin",
  });

  await exigirRespostaOk(resposta);
  return resposta.blob();
}
