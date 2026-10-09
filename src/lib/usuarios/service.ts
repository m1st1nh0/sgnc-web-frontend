import { requireApiUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import type { UsuarioAutenticado } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listarPessoasAbaixo } from "@/lib/permissions/team-scope";
import { ehAdminSistema, ehPapelSemLideranca, PAPEIS as LISTA_PAPEIS } from "@/lib/auth/papeis";

const PAPEIS = new Set(LISTA_PAPEIS);

type UsuarioInput = {
  nome?: unknown;
  email?: unknown;
  papel?: unknown;
  setor?: unknown;
  supervisor_id?: unknown;
  senha_inicial?: unknown;
};


async function requireAdmin() {
  const user = await requireApiUser();
  if (!ehAdminSistema(user.papel)) {
    throw new ApiError("Apenas o Administrador do sistema pode gerenciar usuários e acessos.", 403);
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
  if (!ehPapelSemLideranca(papel) && !supervisorId) {
    throw new ApiError("supervisor_id é obrigatório para papel 'funcionario' ou 'supervisor'.");
  }

  if (!creating) {
    return { nome, papel, setor, supervisor_id: ehPapelSemLideranca(papel) ? null : supervisorId };
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
    supervisor_id: ehPapelSemLideranca(papel) ? null : supervisorId,
    senha_inicial: senhaInicial,
  };
}

export async function validarResponsavel(supervisorId: string | null, usuarioId?: string) {
  if (!supervisorId) return;
  if (usuarioId && supervisorId === usuarioId) throw new ApiError("Um usuário não pode ser supervisor de si mesmo.");

  const { data: supervisor, error } = await createAdminClient()
    .from("usuarios")
    .select("id, papel, ativo")
    .eq("id", supervisorId)
    .maybeSingle();
  if (error || !supervisor || !supervisor.ativo || !["adm", "qualidade", "supervisor"].includes(supervisor.papel)) {
    throw new ApiError("Selecione uma liderança ativa com perfil de supervisor, Qualidade ou administrador.");
  }

  if (usuarioId) {
    const subordinados = await listarPessoasAbaixo(usuarioId);
    if (subordinados.some((pessoa) => pessoa.id === supervisorId)) {
      throw new ApiError("Essa alteração criaria um ciclo na hierarquia. Selecione uma liderança acima desta pessoa.");
    }
  }
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
  await validarResponsavel(dados.supervisor_id);
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
  const requester = await requireAdmin();
  const dados = parseUsuario(input, false);
  await validarResponsavel(dados.supervisor_id, usuarioId);
  if (requester.id === usuarioId && !ehAdminSistema(dados.papel)) {
    throw new ApiError("Você não pode remover o seu próprio perfil de administrador.");
  }

  const atual = await createAdminClient()
    .from("usuarios")
    .select("papel, supervisor_id")
    .eq("id", usuarioId)
    .maybeSingle();
  if (atual.error) throw new ApiError("Não foi possível validar o usuário.", 500);
  if (!atual.data) throw new ApiError("Usuário não encontrado.", 404);
  if (atual.data.papel === "supervisor" && dados.papel !== "supervisor") {
    const subordinados = await listarPessoasAbaixo(usuarioId);
    if (subordinados.length) {
      throw new ApiError("Transfira ou reatribua os liderados antes de alterar o perfil desta liderança.");
    }
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
  if (atual.data.papel !== dados.papel || atual.data.supervisor_id !== dados.supervisor_id) {
    await registrarHistoricoEquipe({
      usuario_id: usuarioId,
      alterado_por: requester.id,
      papel_anterior: atual.data.papel,
      papel_novo: dados.papel,
      supervisor_anterior: atual.data.supervisor_id,
      supervisor_novo: dados.supervisor_id,
      origem: "cadastro",
    });
  }
  return data;
}

export async function alterarAtivo(usuarioId: string, ativo: boolean) {
  const requester = await requireAdmin();
  if (!ativo && requester.id === usuarioId) {
    throw new ApiError("Você não pode desativar sua própria conta.");
  }

  if (!ativo) {
    const { data: atual, error: userError } = await createAdminClient()
      .from("usuarios")
      .select("papel")
      .eq("id", usuarioId)
      .maybeSingle();
    if (userError) throw new ApiError("Não foi possível validar o usuário.", 500);
    if (atual?.papel === "supervisor" && (await listarPessoasAbaixo(usuarioId)).length) {
      throw new ApiError("Reatribua os liderados antes de desativar esta liderança.");
    }
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

/** Trilha de auditoria das mudanças de equipe e de papel (somente inserção). */
export async function registrarHistoricoEquipe(registro: Record<string, unknown>) {
  const { error } = await (createAdminClient() as any).from("historico_equipes").insert(registro);
  if (error) throw new ApiError("A alteração foi salva, mas não foi possível registrar o histórico.", 500);
}
