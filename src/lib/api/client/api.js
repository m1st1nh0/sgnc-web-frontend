import { API_BASE_URL } from "./config.js";

export const EVENTO_SESSAO_EXPIRADA = "sgnc:sessao-expirada";

function encerrarSessaoLocal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA));
}

/**
 * Erro customizado para respostas dos Route Handlers da aplicação.
 */
export class ErroApi extends Error {
  constructor(mensagem, status, campo = null) {
    super(mensagem);
    this.status = status;
    this.campo = campo;
  }
}

async function exigirRespostaOk(resposta) {
  if (resposta.ok) return;

  let mensagem = `Erro ${resposta.status}`;
  let requestId = null;
  let campo = null;
  try {
    const dadosErro = await resposta.json();
    mensagem = dadosErro.detail || mensagem;
    requestId = dadosErro.request_id || null;
    campo = dadosErro.campo || null;
  } catch {
    // resposta sem corpo JSON; mantém a mensagem genérica
  }

  if (resposta.status === 401) {
    encerrarSessaoLocal();
  }

  if (resposta.status >= 500 && requestId) {
    mensagem = `${mensagem} Referência de suporte: ${requestId}.`;
  }

  throw new ErroApi(mensagem, resposta.status, campo);
}

/**
 * Função central para chamadas JSON à rota same-origin. O Route Handler
 * valida a sessão Supabase e executa o serviço migrado no servidor Next.js.
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
 * Faz download autenticado de arquivos binários same-origin.
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
