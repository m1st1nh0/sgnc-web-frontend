import type { UsuarioAutenticado } from "../auth/types";
import { ehQualidade } from "../auth/papeis";

type Medida = { colaborador_id?: unknown; status?: unknown };

/**
 * D19: medida disciplinar só é decidida ou aplicada por alguém da Qualidade (qualidade ou adm)
 * que não seja o colaborador da NC. O banco repete a regra (CHECK e RPCs).
 */
export function podeAtuarNaMedida(medida: Medida, user: UsuarioAutenticado) {
  return ehQualidade(user.papel) && medida.colaborador_id !== user.id;
}

export function podeDecidirMedida(medida: Medida, user: UsuarioAutenticado) {
  return medida.status === "sugerida" && podeAtuarNaMedida(medida, user);
}

export function podeAplicarMedida(medida: Medida, user: UsuarioAutenticado) {
  return medida.status === "aprovada" && podeAtuarNaMedida(medida, user);
}
