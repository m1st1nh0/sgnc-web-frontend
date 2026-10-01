import type { UsuarioAutenticado } from "@/lib/auth/types";

// Mirrors the authenticated SELECT policy for direct reports in the database.
export const SUPERVISOR_VISIBLE_NC_STATUSES = [
  "aguardando_feedback",
  "aguardando_analise",
  "aguardando_aceite",
  "concluida",
] as const;

export function buildNcReadScopeFilter(user: UsuarioAutenticado, teamIds: string[]) {
  if (user.papel === "adm") return null;
  const collaboratorIds = [...new Set([user.id, ...teamIds])];
  return [
    `aberto_por.eq.${user.id}`,
    `and(status.in.(${SUPERVISOR_VISIBLE_NC_STATUSES.join(",")}),colaborador_id.in.(${collaboratorIds.join(",")}))`,
  ].join(",");
}
