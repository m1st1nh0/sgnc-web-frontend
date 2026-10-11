import { requireApiUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import { ehQualidade, podeLiderar } from "@/lib/auth/papeis";
import { createAdminClient } from "@/lib/supabase/admin";
import { temCicloDepartamento } from "./departamentos.js";

/**
 * Departamentos e cargos (plano docs/plano-estrutura-organizacional.md, Fase B).
 * Mantidos pela Qualidade e pelo Administrador (E14). Nada é apagado: desativar mantém o histórico.
 */
async function requireGestorEstrutura() {
  const user = await requireApiUser();
  if (!ehQualidade(user.papel)) throw new ApiError("Somente a Qualidade e o Administrador podem alterar a estrutura.", 403);
  return user;
}

type Departamento = { id: string; nome: string; departamento_pai_id: string | null; responsavel_id: string | null; ativo: boolean };
type Cargo = { id: string; nome: string; departamento_id: string | null; lideranca: boolean; ativo: boolean };

const admin = () => createAdminClient() as any;

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function idOuNulo(valor: unknown) {
  return valor ? String(valor) : null;
}

function erroDeGravacao(error: { code?: string } | null, duplicado: string): never {
  if (error?.code === "23505") throw new ApiError(duplicado, 409);
  throw new ApiError("Não foi possível salvar a estrutura.", 500);
}

async function carregarDepartamentos(): Promise<Departamento[]> {
  const { data, error } = await admin().from("departamentos")
    .select("id, nome, departamento_pai_id, responsavel_id, ativo").order("nome");
  if (error) throw new ApiError("Não foi possível carregar os departamentos.", 500);
  return data ?? [];
}

async function carregarCargos(): Promise<Cargo[]> {
  const { data, error } = await admin().from("cargos")
    .select("id, nome, departamento_id, lideranca, ativo").order("nome");
  if (error) throw new ApiError("Não foi possível carregar os cargos.", 500);
  return data ?? [];
}

export async function listarEstrutura() {
  await requireGestorEstrutura();
  const [departamentos, cargos, pessoas] = await Promise.all([
    carregarDepartamentos(),
    carregarCargos(),
    admin().from("usuarios").select("departamento_id, cargo_id").eq("ativo", true),
  ]);
  if (pessoas.error) throw new ApiError("Não foi possível carregar a estrutura.", 500);
  const contar = (campo: "departamento_id" | "cargo_id", id: string) =>
    (pessoas.data ?? []).filter((pessoa: Record<string, string | null>) => pessoa[campo] === id).length;
  return {
    departamentos: departamentos.map((item) => ({ ...item, pessoas: contar("departamento_id", item.id) })),
    cargos: cargos.map((item) => ({ ...item, pessoas: contar("cargo_id", item.id) })),
  };
}

async function validarResponsavel(responsavelId: string | null) {
  if (!responsavelId) return;
  const { data, error } = await admin().from("usuarios").select("papel, ativo").eq("id", responsavelId).maybeSingle();
  if (error) throw new ApiError("Não foi possível validar o responsável.", 500);
  if (!data?.ativo || !podeLiderar(data.papel)) {
    throw new ApiError("O responsável precisa ser uma liderança ativa (Supervisor, Qualidade ou Administrador).", 422);
  }
}

export async function salvarDepartamento(id: string | null, input: Record<string, unknown>) {
  await requireGestorEstrutura();
  const departamentos = await carregarDepartamentos();
  const atual = id ? departamentos.find((item) => item.id === id) : null;
  if (id && !atual) throw new ApiError("Departamento não encontrado.", 404);

  const nome = input.nome === undefined && atual ? atual.nome : texto(input.nome);
  const paiId = input.departamento_pai_id === undefined && atual ? atual.departamento_pai_id : idOuNulo(input.departamento_pai_id);
  const responsavelId = input.responsavel_id === undefined && atual ? atual.responsavel_id : idOuNulo(input.responsavel_id);
  const ativo = input.ativo === undefined ? atual?.ativo ?? true : input.ativo === true;

  if (!nome) throw new ApiError("Informe o nome do departamento.", 422);
  if (paiId) {
    const pai = departamentos.find((item) => item.id === paiId);
    if (!pai?.ativo) throw new ApiError("Selecione uma área-mãe ativa.", 422);
    if (id && temCicloDepartamento(departamentos, id, paiId)) {
      throw new ApiError("Essa área-mãe criaria um ciclo: ela está dentro deste departamento.", 422);
    }
  }
  if (responsavelId !== atual?.responsavel_id) await validarResponsavel(responsavelId);

  if (atual?.ativo && !ativo) {
    if (departamentos.some((item) => item.ativo && item.departamento_pai_id === id)) {
      throw new ApiError("Desative ou mova as sub-áreas antes de desativar este departamento.", 409);
    }
    const { count } = await admin().from("usuarios").select("id", { count: "exact", head: true })
      .eq("departamento_id", id).eq("ativo", true);
    if (count) throw new ApiError("Mova as pessoas deste departamento antes de desativá-lo.", 409);
  }

  const dados = { nome, departamento_pai_id: paiId, responsavel_id: responsavelId, ativo };
  const consulta = id
    ? admin().from("departamentos").update(dados).eq("id", id)
    : admin().from("departamentos").insert(dados);
  const { data, error } = await consulta.select("id, nome, departamento_pai_id, responsavel_id, ativo").single();
  if (error) erroDeGravacao(error, "Já existe um departamento com esse nome.");

  // O setor (texto) espelha o nome do departamento até Insights e Relatórios usarem o departamento.
  if (atual && atual.nome !== nome) {
    const { error: erroSetor } = await admin().from("usuarios").update({ setor: nome }).eq("departamento_id", id);
    if (erroSetor) throw new ApiError("O departamento foi salvo, mas o setor das pessoas não foi atualizado.", 500);
  }
  return data;
}

export async function salvarCargo(id: string | null, input: Record<string, unknown>) {
  await requireGestorEstrutura();
  const cargos = await carregarCargos();
  const atual = id ? cargos.find((item) => item.id === id) : null;
  if (id && !atual) throw new ApiError("Cargo não encontrado.", 404);

  const nome = input.nome === undefined && atual ? atual.nome : texto(input.nome);
  const departamentoId = input.departamento_id === undefined && atual ? atual.departamento_id : idOuNulo(input.departamento_id);
  const lideranca = input.lideranca === undefined ? atual?.lideranca ?? false : input.lideranca === true;
  const ativo = input.ativo === undefined ? atual?.ativo ?? true : input.ativo === true;

  if (!nome) throw new ApiError("Informe o nome do cargo.", 422);
  if (departamentoId && departamentoId !== atual?.departamento_id) {
    const departamento = (await carregarDepartamentos()).find((item) => item.id === departamentoId);
    if (!departamento?.ativo) throw new ApiError("Selecione um departamento ativo.", 422);
  }
  if (atual && (atual.ativo && !ativo || departamentoId !== atual.departamento_id)) {
    const { count } = await admin().from("usuarios").select("id", { count: "exact", head: true })
      .eq("cargo_id", id).eq("ativo", true);
    if (count) {
      throw new ApiError(
        !ativo ? "Troque o cargo das pessoas antes de desativá-lo." : "Troque o cargo das pessoas antes de mudar o departamento dele.",
        409,
      );
    }
  }

  const dados = { nome, departamento_id: departamentoId, lideranca, ativo };
  const consulta = id ? admin().from("cargos").update(dados).eq("id", id) : admin().from("cargos").insert(dados);
  const { data, error } = await consulta.select("id, nome, departamento_id, lideranca, ativo").single();
  if (error) erroDeGravacao(error, "Já existe um cargo com esse nome neste departamento.");
  return data;
}

/**
 * Valida departamento e cargo de uma pessoa e devolve o setor (texto) correspondente.
 * O cargo precisa ser geral ou do mesmo departamento.
 */
export async function resolverPosicao(departamentoId: string | null, cargoId: string | null) {
  let setor: string | null = null;
  if (departamentoId) {
    const { data } = await admin().from("departamentos").select("nome, ativo").eq("id", departamentoId).maybeSingle();
    if (!data?.ativo) throw new ApiError("Selecione um departamento ativo.", 422);
    setor = data.nome;
  }
  if (cargoId) {
    const { data } = await admin().from("cargos").select("departamento_id, ativo").eq("id", cargoId).maybeSingle();
    if (!data?.ativo) throw new ApiError("Selecione um cargo ativo.", 422);
    if (data.departamento_id && data.departamento_id !== departamentoId) {
      throw new ApiError("Esse cargo é de outro departamento.", 422);
    }
  }
  return { setor };
}

/** Departamento e cargo de uma pessoa, alterados pela aba Equipes, com histórico. */
export async function alterarPosicao(usuarioId: string, input: Record<string, unknown>) {
  const user = await requireGestorEstrutura();
  const departamentoId = idOuNulo(input.departamento_id);
  const cargoId = idOuNulo(input.cargo_id);
  const { data: atual, error } = await admin().from("usuarios")
    .select("departamento_id, cargo_id").eq("id", usuarioId).maybeSingle();
  if (error) throw new ApiError("Não foi possível validar a pessoa.", 500);
  if (!atual) throw new ApiError("Pessoa não encontrada.", 404);
  if (atual.departamento_id === departamentoId && atual.cargo_id === cargoId) {
    throw new ApiError("Nenhuma alteração informada.", 422);
  }

  const { setor } = await resolverPosicao(departamentoId, cargoId);
  const { error: erroUpdate } = await admin().from("usuarios")
    .update({ departamento_id: departamentoId, cargo_id: cargoId, setor }).eq("id", usuarioId);
  if (erroUpdate) throw new ApiError("Não foi possível alterar o departamento.", 500);

  const { error: erroHistorico } = await admin().from("historico_equipes").insert({
    usuario_id: usuarioId,
    alterado_por: user.id,
    departamento_anterior: atual.departamento_id,
    departamento_novo: departamentoId,
    cargo_anterior: atual.cargo_id,
    cargo_novo: cargoId,
    origem: "equipes",
  });
  if (erroHistorico) throw new ApiError("A alteração foi salva, mas não foi possível registrar o histórico.", 500);
  return { ok: true, departamento_id: departamentoId, cargo_id: cargoId, setor };
}
