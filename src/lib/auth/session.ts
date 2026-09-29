import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PapelUsuario = "adm" | "supervisor" | "funcionario";

export type UsuarioAutenticado = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  senha_provisoria: boolean;
};

export async function getUser(): Promise<UsuarioAutenticado | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo, senha_provisoria")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !data || !data.ativo) return null;
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
