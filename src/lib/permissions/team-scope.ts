import "server-only";

import { ApiError } from "@/lib/api/error";
import type { UsuarioAutenticado } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapearProfundidadeLiderados } from "./hierarchy.js";
import { ehQualidade } from "@/lib/auth/papeis";

export type PessoaEquipe = {
  id: string;
  nome: string;
  papel: string;
  setor: string | null;
  supervisor_id: string | null;
  ativo: boolean;
  nivel: number;
};

type PessoaRegistro = Omit<PessoaEquipe, "nivel">;

async function carregarFilhos(supervisorIds: string[]) {
  const admin = createAdminClient();
  const pessoas: PessoaRegistro[] = [];

  for (let group = 0; group < supervisorIds.length; group += 200) {
    const ids = supervisorIds.slice(group, group + 200);
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await admin
        .from("usuarios")
        .select("id, nome, papel, setor, supervisor_id, ativo")
        .in("supervisor_id", ids)
        .not("papel", "in", "(adm,qualidade)")
        .order("id")
        .range(offset, offset + 499);

      if (error) throw new ApiError("Não foi possível validar a hierarquia da equipe.", 500);
      pessoas.push(...((data ?? []) as PessoaRegistro[]));
      if (!data || data.length < 500) break;
    }
  }

  return pessoas;
}

/** Retorna subordinados diretos e indiretos, sem repetir pessoas em hierarquias cíclicas. */
export async function listarPessoasAbaixo(supervisorId: string): Promise<PessoaEquipe[]> {
  const visitados = new Set([supervisorId]);
  let fronteira = [supervisorId];
  const registros: PessoaRegistro[] = [];

  while (fronteira.length) {
    const filhos = await carregarFilhos(fronteira);
    const proxima: string[] = [];

    for (const pessoa of filhos) {
      if (visitados.has(pessoa.id)) continue;
      visitados.add(pessoa.id);
      registros.push(pessoa);
      if (pessoa.papel === "supervisor") proxima.push(pessoa.id);
    }

    fronteira = proxima;
  }

  const niveis = mapearProfundidadeLiderados(supervisorId, registros);
  return registros
    .map((pessoa) => ({ ...pessoa, nivel: niveis.get(pessoa.id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function listarPessoasGerenciaveis(user: UsuarioAutenticado): Promise<PessoaEquipe[]> {
  if (user.papel === "supervisor") return listarPessoasAbaixo(user.id);
  if (!ehQualidade(user.papel)) throw new ApiError("Acesso restrito à Qualidade e às lideranças.", 403);

  const admin = createAdminClient();
  const pessoas: PessoaEquipe[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin
      .from("usuarios")
      .select("id, nome, papel, setor, supervisor_id, ativo")
      .not("papel", "in", "(adm,qualidade)")
      .order("nome")
      .order("id")
      .range(offset, offset + 499);

    if (error) throw new ApiError("Não foi possível carregar as pessoas da organização.", 500);
    pessoas.push(...((data ?? []).map((item) => ({ ...item, nivel: 0 })) as PessoaEquipe[]));
    if (!data || data.length < 500) break;
  }
  return pessoas;
}

export async function validarAcessoPessoa(user: UsuarioAutenticado, pessoaId: string) {
  if (ehQualidade(user.papel)) return;
  if (user.id === pessoaId) return;
  if (user.papel !== "supervisor") {
    throw new ApiError("Você não tem permissão para acessar este colaborador.", 403);
  }

  const pessoas = await listarPessoasAbaixo(user.id);
  if (!pessoas.some((pessoa) => pessoa.id === pessoaId)) {
    throw new ApiError("Você não tem permissão para acessar este colaborador.", 403);
  }
}
