import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import type { PapelUsuario, UsuarioAutenticado } from "./types";
export type { PapelUsuario, UsuarioAutenticado } from "./types";
import { PAPEIS } from "./papeis";

/**
 * Sessão + leitura do usuário, memorizada por renderização com `cache()` do React
 * (layout e página do mesmo acesso fazem uma única consulta). Em Route Handlers o
 * React não memoriza; ali o usuário já carregado é repassado às funções internas.
 */
export const getUser = cache(async function getUser(): Promise<UsuarioAutenticado | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo, senha_provisoria")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !data || !data.ativo || !PAPEIS.includes(data.papel)) return null;
  return data as UsuarioAutenticado;
});

export async function requireUser(options: { allowTemporaryPassword?: boolean } = {}) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!options.allowTemporaryPassword && user.senha_provisoria) redirect("/trocar-senha");
  return user;
}

export async function requireRole(roles: PapelUsuario[]) {
  const user = await requireUser();
  if (!roles.includes(user.papel)) redirect("/");
  return user;
}
