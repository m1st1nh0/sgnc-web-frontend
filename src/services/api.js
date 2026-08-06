import { API_BASE_URL } from "./config";

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

/**
 * Função central que faz todas as chamadas à API.
 * - Anexa automaticamente o token (se houver um salvo)
 * - Se o corpo for um objeto comum, converte para JSON
 * - Se o corpo for um FormData (upload de arquivo), manda como está
 * - Lança ErroApi em respostas de erro, já com a mensagem legível
 */
export async function chamarApi(caminho, { method = "GET", body, semAuth = false } = {}) {
  const headers = {};
  let corpoFinal = undefined;

  if (body instanceof FormData) {
    corpoFinal = body; // o navegador define o Content-Type sozinho (multipart)
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    corpoFinal = JSON.stringify(body);
  }

  if (!semAuth) {
    const token = localStorage.getItem("sgnc_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
    method,
    headers,
    body: corpoFinal,
  });

  if (!resposta.ok) {
    let mensagem = `Erro ${resposta.status}`;
    try {
      const dadosErro = await resposta.json();
      mensagem = dadosErro.detail || mensagem;
    } catch {
      // resposta sem corpo JSON; mantém a mensagem genérica
    }
    throw new ErroApi(mensagem, resposta.status);
  }

  // Algumas respostas (ex: DELETE) podem não ter corpo
  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : null;
}
