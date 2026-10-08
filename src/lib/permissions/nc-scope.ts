import type { UsuarioAutenticado } from "@/lib/auth/types";

// Business rule: the analysed collaborator and their leadership follow the whole NC lifecycle,
// including validated and invalidated NCs, so employees learn from invalidation reasons.
// This is intentionally broader than the legacy nc_select_escopo RLS policy; app reads use the
// service role and this filter is the authority.
export const SUPERVISOR_VISIBLE_NC_STATUSES = [
  "aberta",
  "aguardando_feedback",
  "aguardando_analise",
  "validada",
  "aguardando_aceite",
  "concluida",
  "invalidada",
] as const;

export function buildNcReadScopeFilter(user: UsuarioAutenticado, teamIds: string[]) {
  if (user.papel === "adm") return null;
  const collaboratorIds = [...new Set([user.id, ...teamIds])];
  return [
    `aberto_por.eq.${user.id}`,
    `and(status.in.(${SUPERVISOR_VISIBLE_NC_STATUSES.join(",")}),colaborador_id.in.(${collaboratorIds.join(",")}))`,
  ].join(",");
}

/** Restringe relatórios de equipe às pessoas da hierarquia e ao próprio líder. */
export function buildNcTeamScopeFilter(user: UsuarioAutenticado, teamIds: string[]) {
  if (user.papel === "adm") return null;
  const collaboratorIds = [...new Set([user.id, ...teamIds])];
  return `colaborador_id.in.(${collaboratorIds.join(",")})`;
}
