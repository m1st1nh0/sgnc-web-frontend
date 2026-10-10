import { chamarApi } from "../../../lib/api/client/api.js";

export function listarNotificacoes() {
  return chamarApi("/notificacoes");
}

export function marcarNotificacaoLida(id) {
  return chamarApi(`/notificacoes/${id}/lida`, { method: "POST" });
}

export function marcarTodasLidas() {
  return chamarApi("/notificacoes/lidas", { method: "POST" });
}
