import "server-only";

import { ApiError } from "@/lib/api/error";
import { getUser, type UsuarioAutenticado } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PAPEIS = new Set(["adm", "supervisor", "funcionario"]);

type UsuarioInput = {
  nome?: unknown;
  email?: unknown;
  papel?: unknown;
  setor?: unknown;
  supervisor_id?: unknown;
  senha_inicial?: unknown;
};

async function requireApiUser(options: { allowTemporaryPassword?: boolean } = {}) {
  const user = await getUser();
  if (!user) throw new ApiError("Sessão inválida ou expirada. Faça login novamente.", 401);
  if (!options.allowTemporaryPassword && user.senha_provisoria) {
    throw new ApiError("Troque a senha provisória antes de continuar.", 403);
  }
  return user;
}

async function requireAdmin() {
  const user = await requireApiUser();
  if (user.papel !== "adm") {
    throw new ApiError("Apenas o administrador (Qualidade) pode fazer isso.", 403);
  }
  return user;
}

function parseUsuario(data: UsuarioInput, creating: boolean) {
  const nome = String(data.nome ?? "").trim();
  const papel = String(data.papel ?? "");
  const setor = data.setor ? String(data.setor).trim() : null;
  const supervisorId = data.supervisor_id ? String(data.supervisor_id) : null;

  if (!nome) throw new ApiError("Nome é obrigatório.");
  if (!PAPEIS.has(papel)) throw new ApiError("papel inválido.");
  if (papel !== "adm" && !supervisorId) {
    throw new ApiError("supervisor_id é obrigatório para papel 'funcionario' ou 'supervisor'.");
  }

  if (!creating) {
    return { nome, papel, setor, supervisor_id: papel === "adm" ? null : supervisorId };
  }

  const email = String(data.email ?? "").trim().toLowerCase();
  const senhaInicial = String(data.senha_inicial ?? "");
  if (!email || !email.includes("@")) throw new ApiError("Email inválido.");
  if (senhaInicial.length < 6) throw new ApiError("Senha inicial deve ter ao menos 6 caracteres.");
  return {
    nome,
    email,
    papel,
    setor,
    supervisor_id: papel === "adm" ? null : supervisorId,
    senha_inicial: senhaInicial,
  };
}

export async function listarUsuarios() {
  await requireApiUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, setor, supervisor_id, ativo, senha_provisoria")
    .order("nome");
  if (error) throw new ApiError("Não foi possível carregar os usuários.", 500);
  return data ?? [];
}

export async function listarOpcoesNc() {
  await requireApiUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, setor")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new ApiError("Não foi possível carregar os colaboradores.", 500);
  return data ?? [];
}

export async function criarUsuario(input: UsuarioInput) {
  await requireAdmin();
  const dados = parseUsuario(input, true);
  const admin = createAdminClient();
  const { data: auth, error: authError } = await admin.auth.admin.createUser({
    email: dados.email,
    password: dados.senha_inicial,
    email_confirm: true,
  });
  if (authError || !auth.user) {
    throw new ApiError("Não foi possível criar o login. Verifique os dados informados.");
  }

  const { data, error } = await admin
    .from("usuarios")
    .insert({
      id: auth.user.id,
      nome: dados.nome,
      email: dados.email,
      papel: dados.papel,
      setor: dados.setor,
      supervisor_id: dados.supervisor_id,
      senha_provisoria: true,
    })
    .select()
    .single();
  if (error) {
    await admin.auth.admin.deleteUser(auth.user.id);
    throw new ApiError("Não foi possível cadastrar o usuário.");
  }
  return data;
}

export async function editarUsuario(usuarioId: string, input: UsuarioInput) {
  await requireAdmin();
  const dados = parseUsuario(input, false);
  if (dados.supervisor_id === usuarioId) {
    throw new ApiError("Um usuário não pode ser supervisor de si mesmo.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios")
    .update(dados)
    .eq("id", usuarioId)
    .select()
    .maybeSingle();
  if (error) throw new ApiError("Não foi possível editar o usuário.");
  if (!data) throw new ApiError("Usuário não encontrado.", 404);
  return data;
}

export async function alterarAtivo(usuarioId: string, ativo: boolean) {
  const requester = await requireAdmin();
  if (!ativo && requester.id === usuarioId) {
    throw new ApiError("Você não pode desativar sua própria conta.");
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(usuarioId, {
    ban_duration: ativo ? "none" : "876000h",
  });
  if (authError) throw new ApiError("Não foi possível alterar o acesso do usuário.");

  const { data, error } = await admin
    .from("usuarios")
    .update({ ativo })
    .eq("id", usuarioId)
    .select()
    .maybeSingle();
  if (error) throw new ApiError("Não foi possível alterar o status do usuário.");
  if (!data) throw new ApiError("Usuário não encontrado.", 404);
  return data;
}

export async function trocarSenha(input: { senha_atual?: unknown; senha_nova?: unknown }) {
  const user: UsuarioAutenticado = await requireApiUser({ allowTemporaryPassword: true });
  const senhaAtual = String(input.senha_atual ?? "");
  const senhaNova = String(input.senha_nova ?? "");
  if (senhaNova.length < 6) throw new ApiError("Nova senha deve ter ao menos 6 caracteres.");

  const supabase = await createClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senhaAtual,
  });
  if (loginError) throw new ApiError("Senha atual incorreta.", 401);

  const { error: passwordError } = await supabase.auth.updateUser({ password: senhaNova });
  if (passwordError) throw new ApiError("Não foi possível trocar a senha.");

  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("usuarios")
    .update({ senha_provisoria: false })
    .eq("id", user.id);
  if (profileError) throw new ApiError("Senha alterada, mas não foi possível atualizar o perfil.", 500);
  return { status: "senha_alterada" };
}
