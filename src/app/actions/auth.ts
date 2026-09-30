"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginActionState = { error: string };

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("senha") ?? "");
  if (!email || !password) return { error: "Informe seu email e senha." };

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !auth.user) return { error: "Email ou senha inválidos." };

  const { data: usuario, error: profileError } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo, senha_provisoria")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return { error: "Não foi possível validar seu cadastro. Tente novamente." };
  }
  if (!usuario) {
    await supabase.auth.signOut();
    return { error: "Login válido, mas sem cadastro no sistema SGNC. Contate o administrador." };
  }
  if (!usuario.ativo) {
    await supabase.auth.signOut();
    return { error: "Usuário desativado. Contate o administrador." };
  }

  revalidatePath("/", "layout");
  redirect(usuario.senha_provisoria ? "/trocar-senha" : "/");
}

export async function logoutAction(senhaAlterada = false) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(senhaAlterada ? "/login?senhaAlterada=1" : "/login");
}
