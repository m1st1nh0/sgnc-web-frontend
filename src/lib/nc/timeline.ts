import { ehQualidade } from "../auth/papeis";

export type AutorTimeline = { id: string; nome: string; papel: string };
type Evento = { usuario_id: string | null; observacao: string | null };

/** Rótulo genérico do autor para quem tem acesso restrito à NC (não vê nomes de terceiros). */
function papelDoAutor(papel: string | undefined) {
  if (ehQualidade(papel)) return "Qualidade";
  if (papel === "supervisor") return "Liderança";
  if (papel === "funcionario") return "Colaborador";
  return "Sistema";
}

/**
 * Monta cada evento da linha do tempo com o autor. Com acesso completo, mostra o nome;
 * com acesso restrito, mostra só "Você" ou o papel do autor e oculta a observação.
 */
export function eventosDaTimeline<T extends Evento>(
  eventos: T[],
  autores: Map<string, AutorTimeline>,
  visualizadorId: string,
  acessoCompleto: boolean,
) {
  return eventos.map((evento) => {
    const autor = evento.usuario_id ? autores.get(evento.usuario_id) : undefined;
    if (acessoCompleto) {
      return { ...evento, autor_nome: autor?.nome ?? (evento.usuario_id ? "Usuário removido" : "Sistema") };
    }
    const proprio = !!evento.usuario_id && evento.usuario_id === visualizadorId;
    return {
      ...evento,
      usuario_id: proprio ? evento.usuario_id : null,
      observacao: null,
      autor_nome: proprio ? "Você" : evento.usuario_id ? papelDoAutor(autor?.papel) : "Sistema",
    };
  });
}
