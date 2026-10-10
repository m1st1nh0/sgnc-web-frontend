import { requireApiUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import { ehQualidade } from "@/lib/auth/papeis";
import { normalizeRpc } from "@/lib/nc/service";
import { createAdminClient } from "@/lib/supabase/admin";

/** Montagem das equipes: Administrador do sistema e Qualidade. */
async function requireGestorEquipes() {
  const user = await requireApiUser();
  if (!ehQualidade(user.papel)) throw new ApiError("Somente a Qualidade e o Administrador podem alterar equipes.", 403);
  return user;
}

const ERROS: Record<string, [string, number]> = {
  sem_permissao: ["Somente a Qualidade e o Administrador podem alterar equipes.", 403],
  usuario_nao_encontrado: ["Pessoa não encontrada.", 404],
  papel_fora_das_equipes: ["Perfis de Qualidade e Administrador não fazem parte das equipes. Use a gestão de usuários.", 422],
  papel_invalido: ["Na montagem de equipes o perfil só pode ser Supervisor ou Colaborador.", 422],
  lideranca_obrigatoria: ["Selecione a liderança desta pessoa.", 422],
  lideranca_invalida: ["Selecione uma liderança ativa (supervisor, Qualidade ou administrador).", 422],
  ciclo: ["Essa alteração criaria um ciclo na hierarquia. Selecione uma liderança acima desta pessoa.", 422],
  possui_liderados: ["Transfira os liderados antes de tirar o perfil de liderança desta pessoa.", 409],
  sem_alteracao: ["Nenhuma alteração informada.", 422],
};

export async function listarLiderancas() {
  await requireGestorEquipes();
  const { data, error } = await createAdminClient()
    .from("usuarios")
    .select("id, nome, papel, setor, supervisor_id")
    .eq("ativo", true)
    .in("papel", ["supervisor", "qualidade", "adm"])
    .order("nome");
  if (error) throw new ApiError("Não foi possível carregar as lideranças.", 500);
  return data ?? [];
}

export async function alterarEquipe(usuarioId: string, input: { supervisor_id?: unknown; papel?: unknown }) {
  const user = await requireGestorEquipes();
  const supervisorId = input.supervisor_id ? String(input.supervisor_id) : null;
  const papel = input.papel ? String(input.papel) : null;
  const { data, error } = await (createAdminClient() as any).rpc("alterar_equipe_v1", {
    p_usuario_id: usuarioId,
    p_alterado_por: user.id,
    p_supervisor_id: supervisorId,
    p_papel: papel,
  });
  if (error) throw new ApiError("Não foi possível alterar a equipe.", 500);
  const result = normalizeRpc(data);
  if (!result.ok) {
    const [mensagem, status] = ERROS[String(result.erro)] ?? ["Não foi possível alterar a equipe.", 500];
    throw new ApiError(mensagem, status);
  }
  return result;
}

export async function listarHistoricoEquipe(usuarioId: string) {
  await requireGestorEquipes();
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from("historico_equipes")
    .select("id, alterado_por, papel_anterior, papel_novo, supervisor_anterior, supervisor_novo, origem, criado_em")
    .eq("usuario_id", usuarioId).order("criado_em", { ascending: false }).limit(50);
  if (error) throw new ApiError("Não foi possível carregar o histórico da equipe.", 500);
  const registros = (data ?? []) as Array<Record<string, unknown>>;
  const ids = [...new Set(registros.flatMap((item) => [item.alterado_por, item.supervisor_anterior, item.supervisor_novo])
    .filter((id): id is string => typeof id === "string"))];
  const { data: pessoas } = ids.length
    ? await admin.from("usuarios").select("id, nome").in("id", ids)
    : { data: [] };
  const nomes = new Map((pessoas ?? []).map((pessoa: { id: string; nome: string }) => [pessoa.id, pessoa.nome]));
  const nome = (id: unknown) => (typeof id === "string" ? nomes.get(id) ?? "Usuário" : null);
  return registros.map((item) => ({
    ...item,
    alterado_por_nome: nome(item.alterado_por),
    supervisor_anterior_nome: nome(item.supervisor_anterior),
    supervisor_novo_nome: nome(item.supervisor_novo),
  }));
}
