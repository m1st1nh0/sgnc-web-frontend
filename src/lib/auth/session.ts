import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import type { PapelUsuario, UsuarioAutenticado } from "./types";
export type { PapelUsuario, UsuarioAutenticado } from "./types";

export async function getUser(): Promise<UsuarioAutenticado | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo, senha_provisoria")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !data || !data.ativo || !["adm", "supervisor", "funcionario"].includes(data.papel)) return null;
  return data as UsuarioAutenticado;
}

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

export async function requirePermission(permission: (user: UsuarioAutenticado) => boolean) {
  const user = await requireUser();
  if (!permission(user)) redirect("/");
  return user;
}
