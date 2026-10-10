import { ApiError } from "../api/error";

/** Campos do feedback estruturado, na ordem do formulário (D3: todos obrigatórios; anexo é opcional). */
export const CAMPOS_FEEDBACK = {
  causa_raiz: "Causa raiz",
  acao_combinada: "Ação combinada",
  responsavel_acao: "Responsável pela ação",
  prazo_acao: "Prazo da ação",
  combinado: "Combinado",
} as const;

export type CampoFeedback = keyof typeof CAMPOS_FEEDBACK;

export type FeedbackInput = {
  causa_raiz?: unknown;
  acao_combinada?: unknown;
  responsavel_acao_id?: unknown;
  prazo_acao?: unknown;
  combinado?: unknown;
};

const LIMITE_TEXTO = 4000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

/** Data de hoje no fuso da operação (America/Sao_Paulo), no formato AAAA-MM-DD. */
export function hojeEmSaoPaulo(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/**
 * Valida o feedback antes de chamar a RPC. Lança ApiError 422 com `campo` apontando o
 * primeiro campo com problema, para a interface focar nele. O banco repete as mesmas regras.
 */
export function validarFeedback(input: FeedbackInput, agora = new Date()) {
  const texto = (valor: unknown) => String(valor ?? "").trim();
  const causa_raiz = texto(input.causa_raiz);
  const acao_combinada = texto(input.acao_combinada);
  const responsavel_acao_id = texto(input.responsavel_acao_id);
  const prazo_acao = texto(input.prazo_acao);
  const combinado = texto(input.combinado);

  const obrigatorio = (campo: CampoFeedback) =>
    new ApiError(`Informe o campo “${CAMPOS_FEEDBACK[campo]}”.`, 422, campo);
  const longo = (campo: CampoFeedback) =>
    new ApiError(`“${CAMPOS_FEEDBACK[campo]}” deve ter no máximo 4.000 caracteres.`, 422, campo);

  if (!causa_raiz) throw obrigatorio("causa_raiz");
  if (causa_raiz.length > LIMITE_TEXTO) throw longo("causa_raiz");
  if (!acao_combinada) throw obrigatorio("acao_combinada");
  if (acao_combinada.length > LIMITE_TEXTO) throw longo("acao_combinada");
  if (!responsavel_acao_id) throw obrigatorio("responsavel_acao");
  if (!UUID.test(responsavel_acao_id)) throw erroDoFeedback({ erro: "responsavel_invalido" });
  if (!prazo_acao) throw obrigatorio("prazo_acao");
  if (!dataValida(prazo_acao)) throw new ApiError("Informe uma data válida para o prazo da ação.", 422, "prazo_acao");
  if (prazo_acao < hojeEmSaoPaulo(agora)) throw erroDoFeedback({ erro: "prazo_invalido" });
  if (!combinado) throw obrigatorio("combinado");
  if (combinado.length > LIMITE_TEXTO) throw longo("combinado");

  return { causa_raiz, acao_combinada, responsavel_acao_id, prazo_acao, combinado };
}

/** Traduz os códigos de erro de registrar_feedback_v4 para mensagens com o campo do formulário. */
export function erroDoFeedback(result: Record<string, unknown>): ApiError | null {
  if (result.erro === "campo_obrigatorio") {
    const campo = String(result.campo ?? "") as CampoFeedback;
    const rotulo = CAMPOS_FEEDBACK[campo];
    return new ApiError(rotulo ? `Informe o campo “${rotulo}”.` : "Preencha todos os campos do feedback.", 422, rotulo ? campo : undefined);
  }
  if (result.erro === "prazo_invalido") {
    return new ApiError("O prazo da ação não pode ser anterior a hoje.", 422, "prazo_acao");
  }
  if (result.erro === "responsavel_invalido") {
    return new ApiError("Escolha um usuário ativo como responsável pela ação.", 422, "responsavel_acao");
  }
  return null;
}
